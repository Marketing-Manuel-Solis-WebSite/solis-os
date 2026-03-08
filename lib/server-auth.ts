// ================================================================
// Server-side Firebase ID token verification using Admin SDK
// ================================================================

import { adminAuth } from './firebase-admin';

export interface VerifiedUser {
  uid: string;
  email?: string;
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
