// ================================================================
// Server-side Firebase ID token verification (without firebase-admin)
// Phase 1 containment — will be replaced by Admin SDK in Phase 2
// ================================================================

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

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
 * Verify a Firebase ID token using the REST API.
 * Returns the user's uid/email or null if invalid.
 */
export async function verifyIdToken(idToken: string): Promise<VerifiedUser | null> {
  if (!FIREBASE_API_KEY || !idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const user = data.users?.[0];
    if (!user?.localId) return null;

    return { uid: user.localId, email: user.email };
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
