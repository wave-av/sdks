/**
 * WebBotAuth request signer — concrete impl of the {@link SignerLike} seam.
 *
 * Produces RFC-9421 (HTTP Message Signatures) headers with an Ed25519 key.
 * Signing is OPT-IN (only when a key is configured) and FAILS OPEN: any signing
 * error is reported through the injected {@link CaptureError} hook and an empty
 * header set is returned so the request proceeds unsigned. A signing failure
 * must never block a request.
 *
 * Crypto is `@noble/ed25519` — a small, maintained, dependency-light library
 * that runs on Node, browsers, and edge runtimes. No framework dependency.
 */
import * as ed25519 from '@noble/ed25519';
import type { CaptureError, SignerLike } from './resilience.js';

/** Default signature validity window (60 seconds). */
const DEFAULT_EXPIRES_IN_MS = 60_000;
/** Default signature label used in the `Signature` / `Signature-Input` headers. */
const DEFAULT_LABEL = 'sig1';
/** Default RFC-9421 `tag` parameter identifying the signature purpose. */
const DEFAULT_TAG = 'web-bot-auth';

/** Configuration for {@link createWebBotAuthSigner}. */
export interface WebBotAuthConfig {
  /**
   * Ed25519 private key — a 32-byte seed, as a `Uint8Array` or a hex string.
   * Signing only happens when this is present (opt-in).
   */
  privateKey: Uint8Array | string;
  /** Key identifier surfaced as the `keyid` signature parameter. */
  keyId: string;
  /**
   * Structured-field value for the `Signature-Agent` header (e.g.
   * `"https://wave.online"`). When set, it is emitted and covered by the
   * signature. Pass the full structured-field value (quotes included).
   */
  signatureAgent?: string;
  /** Signature validity window in milliseconds. Default 60000. */
  expiresInMs?: number;
  /**
   * RFC-9421 covered component identifiers. Defaults to
   * `['@authority', '@method', '@path', '@query']`, plus `'signature-agent'`
   * when {@link signatureAgent} is set.
   */
  coveredComponents?: string[];
  /** Signature label. Default `'sig1'`. */
  label?: string;
  /** RFC-9421 `tag` parameter. Default `'web-bot-auth'`. */
  tag?: string;
  /** Injected error sink; receives signing failures (fail-open). */
  captureError?: CaptureError;
  /** Clock override for deterministic testing. Returns epoch milliseconds. */
  now?: () => number;
}

function toBytes(key: Uint8Array | string): Uint8Array {
  return typeof key === 'string' ? ed25519.etc.hexToBytes(key) : key;
}

function base64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64url(bytes: Uint8Array): string {
  return base64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** RFC-9421 Ed25519 request signer. Fails open on any error. */
export class WebBotAuthSigner implements SignerLike {
  private readonly privateKey: Uint8Array;

  constructor(private readonly config: WebBotAuthConfig) {
    this.privateKey = toBytes(config.privateKey);
  }

  /**
   * Produce `Signature`, `Signature-Input` (and, when configured,
   * `Signature-Agent`) headers for the request. Returns `{}` on failure.
   */
  async sign(input: {
    method: string;
    url: string;
    headers: Record<string, string>;
  }): Promise<Record<string, string>> {
    try {
      const url = new URL(input.url);
      const method = input.method.toUpperCase();
      const agent = this.config.signatureAgent;

      const covered =
        this.config.coveredComponents ??
        ['@authority', '@method', '@path', '@query', ...(agent ? ['signature-agent'] : [])];

      const lowerHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(input.headers)) {
        lowerHeaders[k.toLowerCase()] = v;
      }

      const valueFor = (id: string): string | undefined => {
        switch (id) {
          case '@method':
            return method;
          case '@authority':
            return url.host;
          case '@path':
            // RFC-9421 2.2.6: absolute path only; the query is a SEPARATE
            // "@query" derived component and must never be glommed onto "@path".
            return url.pathname;
          case '@target-uri':
            return url.href;
          case '@query':
            // RFC-9421 2.2.7: the full query string including the leading "?".
            // When the query is absent, the value is the "?" character alone.
            return url.search || '?';
          case 'signature-agent':
            return agent;
          default:
            return lowerHeaders[id.toLowerCase()];
        }
      };

      const label = this.config.label ?? DEFAULT_LABEL;
      const tag = this.config.tag ?? DEFAULT_TAG;
      const now = this.config.now ?? Date.now;
      const created = Math.floor(now() / 1000);
      const expires =
        created +
        Math.floor((this.config.expiresInMs ?? DEFAULT_EXPIRES_IN_MS) / 1000);
      const nonce = randomNonce();

      const innerList = covered.map((id) => `"${id}"`).join(' ');
      const params =
        `(${innerList});created=${created};expires=${expires};` +
        `keyid="${this.config.keyId}";alg="ed25519";nonce="${nonce}";tag="${tag}"`;

      const baseLines = covered.map((id) => {
        const value = valueFor(id);
        if (value === undefined) {
          throw new Error(`Missing value for covered component "${id}"`);
        }
        return `"${id}": ${value}`;
      });
      baseLines.push(`"@signature-params": ${params}`);
      const signatureBase = baseLines.join('\n');

      const signature = await ed25519.signAsync(
        new TextEncoder().encode(signatureBase),
        this.privateKey,
      );

      const headers: Record<string, string> = {
        'Signature-Input': `${label}=${params}`,
        Signature: `${label}=:${base64(signature)}:`,
      };
      if (agent) headers['Signature-Agent'] = agent;
      return headers;
    } catch (error) {
      this.config.captureError?.(error, {
        service: 'kernel',
        component: 'web-bot-auth',
      });
      return {};
    }
  }
}

/**
 * Build an Ed25519 WebBotAuth signer implementing {@link SignerLike}. Inject the
 * result via `new WaveKernel({ resilience: { signer } })`; the client wires it
 * into the SDK's request path. Signing is fail-open.
 *
 * @example
 * ```typescript
 * const signer = createWebBotAuthSigner({
 *   privateKey: process.env.KERNEL_SIGNING_KEY_HEX,
 *   keyId: 'wave-2026',
 *   signatureAgent: '"https://wave.online"',
 * });
 * const kernel = new WaveKernel({ apiKey, resilience: { signer } });
 * ```
 */
export function createWebBotAuthSigner(config: WebBotAuthConfig): SignerLike {
  return new WebBotAuthSigner(config);
}
