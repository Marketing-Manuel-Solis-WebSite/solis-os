// ================================================================
// SCIM 2.0 /Users endpoint — List & Create users
// RFC 7644 §3.4.1 (GET) and §3.3 (POST)
// ================================================================

import { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { FieldValue } from 'firebase-admin/firestore';
import { verifySCIMToken } from '@/lib/security/scim-auth';
import {
  mapMemberToSCIM,
  mapSCIMToMember,
  parseSCIMFilter,
  scimError,
  scimListResponse,
  SCIM_USER_SCHEMA,
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

// ---- GET: List / Search Users ----

export async function GET(request: NextRequest) {
  const token = await verifySCIMToken(request);
  if (!token) {
    return scimResponse(scimError(401, 'Invalid or missing SCIM bearer token'), 401);
  }

  try {
    const url = new URL(request.url);
    const startIndex = Math.max(parseInt(url.searchParams.get('startIndex') || '1', 10), 1);
    const count = Math.min(Math.max(parseInt(url.searchParams.get('count') || '100', 10), 1), 500);
    const filter = url.searchParams.get('filter') || '';

    // Fetch all members from Firestore
    const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
    let members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Apply SCIM filter if present
    if (filter) {
      const parsed = parseSCIMFilter(filter);
      if (parsed && parsed.attribute === 'userName' && parsed.operator === 'eq') {
        members = members.filter((m: any) =>
          (m.email || '').toLowerCase() === parsed.value.toLowerCase()
        );
      } else if (parsed && parsed.attribute === 'displayName' && parsed.operator === 'eq') {
        members = members.filter((m: any) =>
          (m.displayName || '').toLowerCase() === parsed.value.toLowerCase()
        );
      } else if (parsed && parsed.attribute === 'active' && parsed.operator === 'eq') {
        const isActive = parsed.value.toLowerCase() === 'true';
        members = members.filter((m: any) => (m.active !== false) === isActive);
      }
    }

    const totalResults = members.length;

    // Paginate (SCIM startIndex is 1-based)
    const sliceStart = startIndex - 1;
    const page = members.slice(sliceStart, sliceStart + count);

    // Fetch Firebase Auth data for the page
    const baseUrl = getBaseUrl(request);
    const resources = await Promise.all(
      page.map(async (member: any) => {
        let firebaseUser = null;
        try {
          const uid = member.id || member.userId;
          const userRecord = await adminAuth.getUser(uid);
          firebaseUser = {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            disabled: userRecord.disabled,
          };
        } catch {
          // User may not exist in Firebase Auth
        }
        return mapMemberToSCIM(member, firebaseUser, baseUrl);
      }),
    );

    return scimResponse(scimListResponse(resources, totalResults, startIndex, page.length));
  } catch (err) {
    console.error('[SCIM] GET /Users error:', err);
    return scimResponse(scimError(500, 'Internal server error'), 500);
  }
}

// ---- POST: Create User ----

export async function POST(request: NextRequest) {
  const token = await verifySCIMToken(request);
  if (!token) {
    return scimResponse(scimError(401, 'Invalid or missing SCIM bearer token'), 401);
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.userName && !body.emails?.length) {
      return scimResponse(scimError(400, 'userName or emails required'), 400);
    }

    const mapped = mapSCIMToMember(body);

    if (!mapped.email) {
      return scimResponse(scimError(400, 'A valid email address is required'), 400);
    }

    // Check if user already exists in Firebase Auth
    let firebaseUser: any = null;
    try {
      firebaseUser = await adminAuth.getUserByEmail(mapped.email);
    } catch {
      // User doesn't exist — we'll create one
    }

    // Check if member already exists in org
    if (firebaseUser) {
      const existingMember = await adminDb
        .doc(`orgs/${ORG}/members/${firebaseUser.uid}`)
        .get();
      if (existingMember.exists) {
        return scimResponse(scimError(409, 'User already exists in this organization'), 409);
      }
    }

    // Create Firebase Auth user if needed
    if (!firebaseUser) {
      firebaseUser = await adminAuth.createUser({
        email: mapped.email,
        displayName: mapped.displayName,
        disabled: !mapped.active,
      });
    }

    // Create org member document (matches createMember pattern from lib/db.ts)
    const memberData = {
      userId: firebaseUser.uid,
      orgId: ORG,
      role: 'member' as const,
      teamId: mapped.teamIds[0] || '',
      teamIds: mapped.teamIds,
      displayName: mapped.displayName,
      email: mapped.email,
      title: mapped.title,
      department: '',
      managerId: '',
      hierarchyLevel: 'member',
      photoURL: '',
      active: mapped.active,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.doc(`orgs/${ORG}/members/${firebaseUser.uid}`).set(memberData, { merge: true });

    // Return the created SCIM user
    const baseUrl = getBaseUrl(request);
    const scimUser = mapMemberToSCIM(
      { id: firebaseUser.uid, ...memberData },
      {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        disabled: firebaseUser.disabled,
      },
      baseUrl,
    );

    return scimResponse(scimUser, 201);
  } catch (err: any) {
    console.error('[SCIM] POST /Users error:', err);
    if (err?.code === 'auth/email-already-exists') {
      return scimResponse(scimError(409, 'A user with this email already exists'), 409);
    }
    return scimResponse(scimError(500, 'Internal server error'), 500);
  }
}
