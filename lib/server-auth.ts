// ================================================================
// Server-side Firebase ID token verification using Admin SDK
// ================================================================

import { adminAuth, adminDb } from './firebase-admin';

const ORG = 'solis-center';

export interface VerifiedUser {
  uid: string;
  email?: string;
  role?: string;
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1] || null;
}

/**
 * Verify a Firebase ID token using Admin SDK.
 * Returns the user's uid/email or null if invalid.
 */
export async function verifyIdToken(idToken: string): Promise<VerifiedUser | null> {
  if (!idToken) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.uid) return null;
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Authenticate a request by verifying the Authorization: Bearer <token> header.
 * Returns the verified user or null.
 */
export async function authenticateRequest(request: Request): Promise<VerifiedUser | null> {
  const token = extractToken(request.headers.get('Authorization'));
  if (!token) return null;
  return verifyIdToken(token);
}

/**
 * Authenticate a request AND verify the user has an admin/owner role.
 * Returns the verified user with role, or null if not authenticated or not admin.
 */
export async function authenticateAdmin(request: Request): Promise<VerifiedUser | null> {
  const user = await authenticateRequest(request);
  if (!user) return null;

  try {
    const memberDoc = await adminDb
      .collection(`orgs/${ORG}/members`)
      .doc(user.uid)
      .get();

    if (!memberDoc.exists) return null;

    const role = memberDoc.data()?.role as string | undefined;
    if (role !== 'admin' && role !== 'owner') return null;

    return { ...user, role };
  } catch {
    return null;
  }
}
