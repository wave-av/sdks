import { describe, it, expect } from 'vitest';
import * as ed25519 from '@noble/ed25519';
import {
  createWebBotAuthSigner,
  WebBotAuthSigner,
} from '../web-bot-auth.js';

const KEY_HEX = '00'.repeat(31) + '07';
const FIXED_NOW = () => 1_700_000_000_000;

/**
 * Independently rebuild the RFC-9421 signature base a spec-compliant verifier
 * would construct — driven ONLY by the produced `Signature-Input` header and
 * the request, NOT by the signer's own base builder. Parses the covered
 * component list (in header order), recomputes each derived component value
 * from the request per RFC-9421, and appends the verbatim `@signature-params`.
 */
function reconstructBase(
  req: { method: string; url: string; signatureAgent?: string },
  signatureInput: string,
  label = 'sig1',
): string {
  const params = signatureInput.replace(new RegExp(`^${label}=`), '');
  const inner = params.slice(params.indexOf('(') + 1, params.indexOf(')'));
  const ids = inner.length
    ? inner.split(' ').map((t) => t.replace(/^"|"$/g, ''))
    : [];
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const valueFor = (id: string): string => {
    switch (id) {
      case '@method':
        return method;
      case '@authority':
        return url.host;
      case '@path':
        return url.pathname;
      case '@query':
        return url.search || '?';
      case '@target-uri':
        return url.href;
      case 'signature-agent':
        return req.signatureAgent ?? '';
      default:
        throw new Error(`test reconstruct: unhandled component "${id}"`);
    }
  };
  const lines = ids.map((id) => `"${id}": ${valueFor(id)}`);
  lines.push(`"@signature-params": ${params}`);
  return lines.join('\n');
}

async function verifySigned(
  req: { method: string; url: string; signatureAgent?: string },
  out: Record<string, string>,
  pub: Uint8Array,
): Promise<boolean> {
  const base = reconstructBase(req, out['Signature-Input']);
  const sigB64 = out['Signature'].replace(/^sig1=:/, '').replace(/:$/, '');
  const sigBytes = Uint8Array.from(Buffer.from(sigB64, 'base64'));
  return ed25519.verifyAsync(sigBytes, new TextEncoder().encode(base), pub);
}

describe('createWebBotAuthSigner', () => {
  it('returns a WebBotAuthSigner', () => {
    expect(
      createWebBotAuthSigner({ privateKey: KEY_HEX, keyId: 'k1' }),
    ).toBeInstanceOf(WebBotAuthSigner);
  });

  it('produces RFC-9421 Signature and Signature-Input headers', async () => {
    const signer = createWebBotAuthSigner({
      privateKey: KEY_HEX,
      keyId: 'k1',
      now: FIXED_NOW,
    });
    const out = await signer.sign({
      method: 'get',
      url: 'https://api.onkernel.com/browsers?x=1',
      headers: {},
    });
    expect(out['Signature']).toMatch(/^sig1=:.+:$/);
    expect(out['Signature-Input']).toContain('keyid="k1"');
    expect(out['Signature-Input']).toContain('alg="ed25519"');
    expect(out['Signature-Input']).toContain('created=1700000000');
    expect(out['Signature-Input']).toContain('expires=1700000060');
    // Default covered set now carries @query as a distinct component.
    expect(out['Signature-Input']).toContain(
      '"@authority" "@method" "@path" "@query"',
    );
    expect(out['Signature-Agent']).toBeUndefined();
  });

  it('includes and covers Signature-Agent when configured', async () => {
    const signer = createWebBotAuthSigner({
      privateKey: KEY_HEX,
      keyId: 'k1',
      signatureAgent: '"https://wave.online"',
    });
    const out = await signer.sign({
      method: 'GET',
      url: 'https://api.onkernel.com/',
      headers: {},
    });
    expect(out['Signature-Agent']).toBe('"https://wave.online"');
    expect(out['Signature-Input']).toContain('"signature-agent"');
  });

  it('signs a URL WITH query params so a real verifier reconstructs a byte-identical base', async () => {
    const priv = ed25519.etc.hexToBytes(KEY_HEX);
    const pub = await ed25519.getPublicKeyAsync(priv);
    const signer = createWebBotAuthSigner({
      privateKey: priv,
      keyId: 'k1',
      now: FIXED_NOW,
    });
    const req = {
      method: 'GET',
      url: 'https://api.onkernel.com/browsers?foo=bar&baz=1',
    };
    const out = await signer.sign({ ...req, headers: {} });

    // @path must be path-only; @query must carry the full query separately.
    const base = reconstructBase(req, out['Signature-Input']);
    expect(base).toContain('"@path": /browsers\n');
    expect(base).toContain('"@query": ?foo=bar&baz=1');
    expect(base).not.toContain('/browsers?foo=bar');

    expect(await verifySigned(req, out, pub)).toBe(true);
  });

  it('signs a URL with NO query: @path is bare path and @query is "?"', async () => {
    const priv = ed25519.etc.hexToBytes(KEY_HEX);
    const pub = await ed25519.getPublicKeyAsync(priv);
    const signer = createWebBotAuthSigner({
      privateKey: priv,
      keyId: 'k1',
      now: FIXED_NOW,
    });
    const req = { method: 'POST', url: 'https://api.onkernel.com/v1/x' };
    const out = await signer.sign({ ...req, headers: {} });

    const base = reconstructBase(req, out['Signature-Input']);
    expect(base).toContain('"@path": /v1/x\n');
    expect(base).toContain('"@query": ?\n');

    expect(await verifySigned(req, out, pub)).toBe(true);
  });

  it('fails open: returns {} and reports via captureError on invalid input', async () => {
    const errors: unknown[] = [];
    const signer = createWebBotAuthSigner({
      privateKey: KEY_HEX,
      keyId: 'k1',
      captureError: (e) => errors.push(e),
    });
    const out = await signer.sign({
      method: 'GET',
      url: 'not-a-valid-url',
      headers: {},
    });
    expect(out).toEqual({});
    expect(errors).toHaveLength(1);
  });
});
