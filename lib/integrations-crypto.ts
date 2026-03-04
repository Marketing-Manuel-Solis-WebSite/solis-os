import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

// ============================================
// API KEY GENERATION
// ============================================
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const bytes = randomBytes(32);
  const raw = `sk_live_${bytes.toString('hex')}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

// ============================================
// HMAC WEBHOOK SIGNING
// ============================================
export function signPayload(secret: string, payload: string): string {
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${sig}`;
}

export function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = signPayload(secret, payload);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ============================================
// OAUTH TOKEN ENCRYPTION (AES-256-GCM)
// ============================================
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPT_KEY;
  if (!key || key.length < 64) {
    throw new Error('INTEGRATION_ENCRYPT_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ============================================
// GENERATORS
// ============================================
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

export function generateEndpointToken(): string {
  return [
    randomBytes(4).toString('hex'),
    randomBytes(2).toString('hex'),
    randomBytes(2).toString('hex'),
    randomBytes(2).toString('hex'),
    randomBytes(6).toString('hex'),
  ].join('-');
}
