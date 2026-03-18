// ================================================================
// SCIM 2.0 /Users/{id} endpoint — Get, Replace, Patch, Delete
// RFC 7644 §3.4.1 (GET), §3.5.1 (PUT), §3.5.2 (PATCH), §3.6 (DELETE)
// ================================================================

import { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { FieldValue } from 'firebase-admin/firestore';
import { verifySCIMToken } from '@/lib/security/scim-auth';
import {
  mapMemberToSCIM,
  mapSCIMToMember,
  scimError,
  SCIM_PATCH_SCHEMA,
  type SCIMPatchOperation,
} from '@/lib/security/scim-adapter';

const SCIM_JSON = 'application/scim+json';

function scimResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': SCIM_JSON },
  });
}

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'localhost';
  return `${proto}://${host}`;
}

type RouteContext = { params: Promise<{ id: string }> };

// ---- GET: Single User ----

export async function GET(request: NextRequest, ctx: RouteContext) {
  const token = await verifySCIMToken(request);
  if (!token) {
    return scimResponse(scimError(401, 'Invalid or missing SCIM bearer token'), 401);
  }

  try {
    const { id } = await ctx.params;

    // Fetch member from org
    const memberSnap = await adminDb.doc(`orgs/${ORG}/members/${id}`).get();
    if (!memberSnap.exists) {
      return scimResponse(scimError(404, `User ${id} not found`), 404);
    }

    const member = { id: memberSnap.id, ...memberSnap.data() };

    // Fetch Firebase Auth user
    let firebaseUser = null;
    try {
      const userRecord = await adminAuth.getUser(id);
      firebaseUser = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        disabled: userRecord.disabled,
      };
    } catch {
      // User may not exist in Auth
    }

    const baseUrl = getBaseUrl(request);
    return scimResponse(mapMemberToSCIM(member, firebaseUser, baseUrl));
  } catch (err) {
    console.error('[SCIM] GET /Users/{id} error:', err);
    return scimResponse(scimError(500, 'Internal server error'), 500);
  }
}

// ---- PUT: Full Replace User ----

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const token = await verifySCIMToken(request);
  if (!token) {
    return scimResponse(scimError(401, 'Invalid or missing SCIM bearer token'), 401);
  }

  try {
    const { id } = await ctx.params;

    // Check member exists
    const memberSnap = await adminDb.doc(`orgs/${ORG}/members/${id}`).get();
    if (!memberSnap.exists) {
      return scimResponse(scimError(404, `User ${id} not found`), 404);
    }

    const body = await request.json();
    const mapped = mapSCIMToMember(body);

    // Update Firebase Auth user
    try {
      const updateData: any = { disabled: !mapped.active };
      if (mapped.displayName) updateData.displayName = mapped.displayName;
      if (mapped.email) updateData.email = mapped.email;
      await adminAuth.updateUser(id, updateData);
    } catch (err) {
      console.error('[SCIM] PUT Firebase Auth update failed:', err);
    }

    // Update member document
    const memberUpdate: any = {
      displayName: mapped.displayName,
      email: mapped.email,
      title: mapped.title,
      active: mapped.active,
      teamId: mapped.teamIds[0] || '',
      teamIds: mapped.teamIds,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.doc(`orgs/${ORG}/members/${id}`).update(memberUpdate);

    // Return updated SCIM user
    let firebaseUser = null;
    try {
      const userRecord = await adminAuth.getUser(id);
      firebaseUser = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        disabled: userRecord.disabled,
      };
    } catch { /* ignore */ }

    const baseUrl = getBaseUrl(request);
    const updatedMember = { id, ...memberSnap.data(), ...memberUpdate };
    return scimResponse(mapMemberToSCIM(updatedMember, firebaseUser, baseUrl));
  } catch (err) {
    console.error('[SCIM] PUT /Users/{id} error:', err);
    return scimResponse(scimError(500, 'Internal server error'), 500);
  }
}

// ---- PATCH: Partial Update (SCIM PatchOp) ----

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const token = await verifySCIMToken(request);
  if (!token) {
    return scimResponse(scimError(401, 'Invalid or missing SCIM bearer token'), 401);
  }

  try {
    const { id } = await ctx.params;

    // Check member exists
    const memberSnap = await adminDb.doc(`orgs/${ORG}/members/${id}`).get();
    if (!memberSnap.exists) {
      return scimResponse(scimError(404, `User ${id} not found`), 404);
    }

    const body = await request.json();

    // Validate PatchOp schema
    if (
      !body.schemas?.includes(SCIM_PATCH_SCHEMA) &&
      !body.Operations?.length
    ) {
      return scimResponse(scimError(400, 'Invalid SCIM PatchOp request'), 400);
    }

    const operations: SCIMPatchOperation[] = body.Operations || [];
    const memberUpdate: Record<string, any> = {};
    const authUpdate: Record<string, any> = {};

    for (const op of operations) {
      if (op.op === 'replace' || op.op === 'add') {
        // Handle path-based operations
        if (op.path) {
          switch (op.path) {
            case 'userName':
            case 'emails[type eq "work"].value':
              memberUpdate.email = op.value as string;
              authUpdate.email = op.value as string;
              break;
            case 'displayName':
              memberUpdate.displayName = op.value as string;
              authUpdate.displayName = op.value as string;
              break;
            case 'name.givenName': {
              const currentName = (memberSnap.data() as any)?.displayName || '';
              const parts = currentName.split(' ');
              parts[0] = op.value as string;
              memberUpdate.displayName = parts.join(' ');
              authUpdate.displayName = memberUpdate.displayName;
              break;
            }
            case 'name.familyName': {
              const currentName = (memberSnap.data() as any)?.displayName || '';
              const parts = currentName.split(' ');
              const given = parts[0] || '';
              memberUpdate.displayName = `${given} ${op.value}`.trim();
              authUpdate.displayName = memberUpdate.displayName;
              break;
            }
            case 'title':
              memberUpdate.title = op.value as string;
              break;
            case 'active':
              memberUpdate.active = op.value === true || op.value === 'true';
              authUpdate.disabled = !(op.value === true || op.value === 'true');
              break;
          }
        } else if (op.value && typeof op.value === 'object' && !Array.isArray(op.value)) {
          // Handle value-object operations (e.g., Azure AD sends { active: false })
          const val = op.value as Record<string, unknown>;
          if ('active' in val) {
            memberUpdate.active = val.active === true || val.active === 'true';
            authUpdate.disabled = !memberUpdate.active;
          }
          if ('displayName' in val) {
            memberUpdate.displayName = val.displayName as string;
            authUpdate.displayName = val.displayName as string;
          }
          if ('userName' in val) {
            memberUpdate.email = val.userName as string;
            authUpdate.email = val.userName as string;
          }
          if ('title' in val) {
            memberUpdate.title = val.title as string;
          }
        }
      } else if (op.op === 'remove') {
        if (op.path === 'title') memberUpdate.title = '';
      }
    }

    // Apply Firebase Auth updates
    if (Object.keys(authUpdate).length > 0) {
      try {
        await adminAuth.updateUser(id, authUpdate);
      } catch (err) {
        console.error('[SCIM] PATCH Firebase Auth update failed:', err);
      }
    }

    // Apply member document updates
    if (Object.keys(memberUpdate).length > 0) {
      memberUpdate.updatedAt = FieldValue.serverTimestamp();
      await adminDb.doc(`orgs/${ORG}/members/${id}`).update(memberUpdate);
    }

    // Return updated SCIM user
    let firebaseUser = null;
    try {
      const userRecord = await adminAuth.getUser(id);
      firebaseUser = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        disabled: userRecord.disabled,
      };
    } catch { /* ignore */ }

    const baseUrl = getBaseUrl(request);
    const updatedMember = { id, ...memberSnap.data(), ...memberUpdate };
    return scimResponse(mapMemberToSCIM(updatedMember, firebaseUser, baseUrl));
  } catch (err) {
    console.error('[SCIM] PATCH /Users/{id} error:', err);
    return scimResponse(scimError(500, 'Internal server error'), 500);
  }
}

// ---- DELETE: Deactivate User (soft delete) ----

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const token = await verifySCIMToken(request);
  if (!token) {
    return scimResponse(scimError(401, 'Invalid or missing SCIM bearer token'), 401);
  }

  try {
    const { id } = await ctx.params;

    // Check member exists
    const memberSnap = await adminDb.doc(`orgs/${ORG}/members/${id}`).get();
    if (!memberSnap.exists) {
      return scimResponse(scimError(404, `User ${id} not found`), 404);
    }

    // Soft delete: deactivate member (matches softDeleteMember pattern)
    await adminDb.doc(`orgs/${ORG}/members/${id}`).update({
      active: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Disable in Firebase Auth
    try {
      await adminAuth.updateUser(id, { disabled: true });
    } catch (err) {
      console.error('[SCIM] DELETE Firebase Auth disable failed:', err);
    }

    // SCIM DELETE returns 204 No Content
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[SCIM] DELETE /Users/{id} error:', err);
    return scimResponse(scimError(500, 'Internal server error'), 500);
  }
}
