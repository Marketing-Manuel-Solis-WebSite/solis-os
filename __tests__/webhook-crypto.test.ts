import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature } from '../lib/integrations-crypto';

// ============================================
// signPayload
// ============================================
describe('signPayload', () => {
  it('creates an HMAC-SHA256 signature in sha256=<hex> format', () => {
    const sig = signPayload('my-secret', '{"event":"test"}');
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('is deterministic: same secret + same payload = same signature', () => {
    const payload = '{"id":1,"name":"test"}';
    const secret = 'deterministic-secret';
    const sig1 = signPayload(secret, payload);
    const sig2 = signPayload(secret, payload);
    expect(sig1).toBe(sig2);
  });

  it('different secret produces different signature', () => {
    const payload = '{"event":"webhook"}';
    const sig1 = signPayload('secret-a', payload);
    const sig2 = signPayload('secret-b', payload);
    expect(sig1).not.toBe(sig2);
  });

  it('different payload produces different signature', () => {
    const secret = 'shared-secret';
    const sig1 = signPayload(secret, '{"a":1}');
    const sig2 = signPayload(secret, '{"a":2}');
    expect(sig1).not.toBe(sig2);
  });

  it('handles empty payload', () => {
    const sig = signPayload('secret', '');
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('handles unicode payload', () => {
    const sig = signPayload('secret', '{"name":"Carlos Añaya","emoji":"🔑"}');
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('returns hex string format (no base64, no binary)', () => {
    const sig = signPayload('key', 'data');
    const hex = sig.replace('sha256=', '');
    // hex chars only, exactly 64 chars (256 bits / 4 bits per hex char)
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });
});

// ============================================
// verifySignature
// ============================================
describe('verifySignature', () => {
  const secret = 'webhook-secret-123';
  const payload = '{"event":"task_created","taskId":"abc"}';

  it('returns true for a valid signature', () => {
    const sig = signPayload(secret, payload);
    expect(verifySignature(secret, payload, sig)).toBe(true);
  });

  it('returns false for an invalid/garbage signature', () => {
    expect(verifySignature(secret, payload, 'sha256=0000000000000000000000000000000000000000000000000000000000000000')).toBe(false);
  });

  it('returns false for a completely malformed signature', () => {
    expect(verifySignature(secret, payload, 'not-a-signature')).toBe(false);
  });

  it('returns false when secret is wrong', () => {
    const sig = signPayload(secret, payload);
    expect(verifySignature('wrong-secret', payload, sig)).toBe(false);
  });

  it('returns false when payload is tampered', () => {
    const sig = signPayload(secret, payload);
    const tampered = payload.replace('abc', 'xyz');
    expect(verifySignature(secret, tampered, sig)).toBe(false);
  });

  it('returns false for empty signature', () => {
    expect(verifySignature(secret, payload, '')).toBe(false);
  });

  it('roundtrip: sign then verify with empty payload', () => {
    const sig = signPayload(secret, '');
    expect(verifySignature(secret, '', sig)).toBe(true);
  });

  it('roundtrip: sign then verify with unicode payload', () => {
    const unicodePayload = '{"descripción":"tarea urgente","prioridad":"alta 🔴"}';
    const sig = signPayload(secret, unicodePayload);
    expect(verifySignature(secret, unicodePayload, sig)).toBe(true);
  });

  it('returns false when signature has extra characters appended', () => {
    const sig = signPayload(secret, payload);
    expect(verifySignature(secret, payload, sig + 'extra')).toBe(false);
  });

  it('returns false when signature prefix is missing', () => {
    const sig = signPayload(secret, payload);
    const hexOnly = sig.replace('sha256=', '');
    expect(verifySignature(secret, payload, hexOnly)).toBe(false);
  });
});
