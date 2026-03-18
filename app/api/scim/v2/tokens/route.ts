// ================================================================
// SCIM Token Management API — for the admin UI
// Protected by Firebase Auth (admin role required)
// ================================================================

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import {
  generateSCIMToken,
  revokeSCIMToken,
  listSCIMTokens,
} from '@/lib/security/scim-auth';

// ---- GET: List all tokens (redacted) ----

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const tokens = await listSCIMTokens();
    return Response.json({ tokens });
  } catch (err) {
    console.error('[SCIM Tokens] List error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---- POST: Create a new token ----

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const body = await request.json();
    const name = body.name?.trim();

    if (!name) {
      return Response.json({ error: 'Token name is required' }, { status: 400 });
    }

    const result = await generateSCIMToken(name, admin.uid);
    return Response.json({ id: result.id, token: result.token }, { status: 201 });
  } catch (err) {
    console.error('[SCIM Tokens] Create error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---- DELETE: Revoke a token ----

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const body = await request.json();
    const tokenId = body.tokenId?.trim();

    if (!tokenId) {
      return Response.json({ error: 'Token ID is required' }, { status: 400 });
    }

    await revokeSCIMToken(tokenId);
    return Response.json({ success: true });
  } catch (err) {
    console.error('[SCIM Tokens] Revoke error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
