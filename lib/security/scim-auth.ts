// ================================================================
// SCIM 2.0 Bearer Token Authentication
// ================================================================
// SCIM tokens are separate from Firebase Auth tokens.
// Stored at: orgs/{orgId}/scimTokens/{tokenId}
// Format: scim_{orgId}_{random}
// Tokens are stored as SHA-256 hashes for security.

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

// ---- Interfaces ----

export interface SCIMToken {
  id: string;
  tokenPrefix: string; // First 12 chars for UI identification
  name: string;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  lastUsedAt: FirebaseFirestore.Timestamp | null;
  active: boolean;
}

// ---- Hashing ----

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---- Token Verification ----

/**
 * Extract and validate a SCIM Bearer token from the request.
 * Compares SHA-256 hash. Supports legacy plaintext tokens with auto-migration.
 * Updates lastUsedAt on success.
 */
export async function verifySCIMToken(request: Request): Promise<SCIMToken | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  const bearerToken = parts[1];
  if (!bearerToken || !bearerToken.startsWith('scim_')) return null;

  try {
    const tokenHash = hashToken(bearerToken);

    // Try hashed token first (new format)
    let snap = await adminDb
      .collection(`orgs/${ORG}/scimTokens`)
      .where('tokenHash', '==', tokenHash)
      .where('active', '==', true)
      .limit(1)
      .get();

    // Migration fallback: check legacy plaintext tokens
    if (snap.empty) {
      snap = await adminDb
        .collection(`orgs/${ORG}/scimTokens`)
        .where('token', '==', bearerToken)
        .where('active', '==', true)
        .limit(1)
        .get();

      if (!snap.empty) {
        // Auto-migrate: hash the token and remove plaintext
        const doc = snap.docs[0];
        doc.ref.update({
          tokenHash,
          tokenPrefix: bearerToken.slice(0, 12),
          token: FieldValue.delete(),
        }).catch(() => {}); // best-effort migration
      }
    }

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data();

    // Update lastUsedAt (fire-and-forget)
    doc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});

    return {
      id: doc.id,
      tokenPrefix: data.tokenPrefix || bearerToken.slice(0, 12),
      name: data.name,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      lastUsedAt: data.lastUsedAt,
      active: data.active,
    };
  } catch (err) {
    console.error('[SCIM Auth] Token verification failed:', err);
    return null;
  }
}

// ---- Token Management ----

/**
 * Generate a new SCIM provisioning token.
 * Stores SHA-256 hash only. Returns the full token string ONCE.
 */
export async function generateSCIMToken(
  name: string,
  userId: string,
): Promise<{ id: string; token: string }> {
  const random = crypto.randomUUID().replace(/-/g, '');
  const token = `scim_${ORG}_${random}`;

  const ref = await adminDb.collection(`orgs/${ORG}/scimTokens`).add({
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 12),
    name: name || 'SCIM Token',
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
    active: true,
  });

  return { id: ref.id, token };
}

/**
 * Revoke (deactivate) a SCIM token.
 */
export async function revokeSCIMToken(tokenId: string): Promise<void> {
  await adminDb.doc(`orgs/${ORG}/scimTokens/${tokenId}`).update({
    active: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * List all SCIM tokens (token value never exposed).
 */
export async function listSCIMTokens(): Promise<SCIMToken[]> {
  const snap = await adminDb
    .collection(`orgs/${ORG}/scimTokens`)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      tokenPrefix: data.tokenPrefix || '****',
      name: data.name,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      lastUsedAt: data.lastUsedAt,
      active: data.active,
    };
  });
}
