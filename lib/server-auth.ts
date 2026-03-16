// ================================================================
// Server-side Firebase ID token verification using Admin SDK
// ================================================================

import { adminAuth, adminDb } from './firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';

export interface VerifiedUser {
  uid: string;
  email?: string;
  role?: string;
}

export type AdminAuthResult =
  | { status: 'authenticated'; user: VerifiedUser }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' };

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
 * Returns typed result distinguishing unauthenticated (401) from forbidden (403).
 */
export async function authenticateAdmin(request: Request): Promise<AdminAuthResult> {
  const user = await authenticateRequest(request);
  if (!user) return { status: 'unauthenticated' };

  try {
    const memberDoc = await adminDb
      .collection(`orgs/${ORG}/members`)
      .doc(user.uid)
      .get();

    if (!memberDoc.exists) return { status: 'forbidden' };

    const role = memberDoc.data()?.role as string | undefined;
    if (role !== 'admin' && role !== 'owner') return { status: 'forbidden' };

    return { status: 'authenticated', user: { ...user, role } };
  } catch {
    return { status: 'unauthenticated' };
  }
}

/**
 * Helper: return the appropriate NextResponse for a failed AdminAuthResult.
 * Returns null if authenticated (caller should proceed).
 * Acts as a type guard: after `if (adminAuthError(auth)) return ...`, auth is narrowed.
 */
export function adminAuthError(result: AdminAuthResult): Response | null {
  if (result.status === 'authenticated') return null;
  if (result.status === 'unauthenticated') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json({ error: 'Admin role required' }, { status: 403 });
}

/**
 * Convenience: authenticate admin and return user directly, or a Response error.
 * Callers: `const r = await requireAdmin(req); if (r instanceof Response) return r;`
 * After the guard, `r` is typed as `VerifiedUser`.
 */
export async function requireAdmin(request: Request): Promise<VerifiedUser | Response> {
  const result = await authenticateAdmin(request);
  if (result.status !== 'authenticated') {
    return adminAuthError(result)!;
  }
  return result.user;
}
