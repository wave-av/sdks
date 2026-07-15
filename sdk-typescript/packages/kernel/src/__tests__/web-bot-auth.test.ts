import { describe, it, expect } from 'vitest';
import * as ed25519 from '@noble/ed25519';
import {
  createWebBotAuthSigner,
  WebBotAuthSigner,
} from '../web-bot-auth.js';

const KEY_HEX = '00'.repeat(31) + '07';
const FIXED_NOW = () => 1_700_000_000_000;

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
    expect(out['Signature-Input']).toContain('"@authority" "@method" "@path"');
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

  it('produces a signature that verifies against the reconstructed base', async () => {
    const priv = ed25519.etc.hexToBytes(KEY_HEX);
    const pub = await ed25519.getPublicKeyAsync(priv);
    const signer = createWebBotAuthSigner({
      privateKey: priv,
      keyId: 'k1',
      coveredComponents: ['@method', '@authority', '@path'],
      now: FIXED_NOW,
    });
    const out = await signer.sign({
      method: 'POST',
      url: 'https://api.onkernel.com/v1/x?a=b',
      headers: {},
    });

    // Reconstruct the signature base using the actual (nonce-bearing) params.
    const params = out['Signature-Input'].replace(/^sig1=/, '');
    const base = [
      '"@method": POST',
      '"@authority": api.onkernel.com',
      '"@path": /v1/x?a=b',
      `"@signature-params": ${params}`,
    ].join('\n');
    const sigB64 = out['Signature'].replace(/^sig1=:/, '').replace(/:$/, '');
    const sigBytes = Uint8Array.from(Buffer.from(sigB64, 'base64'));

    const ok = await ed25519.verifyAsync(
      sigBytes,
      new TextEncoder().encode(base),
      pub,
    );
    expect(ok).toBe(true);
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
