import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ================================================================
// Shared helper: look up share link, validate, and return doc
// ================================================================

async function fetchSharedDoc(token: string, password?: string | null) {
  // Look up the share link by token
  const linkSnap = await adminDb.collection('shareLinks')
    .where('token', '==', token)
    .where('active', '==', true)
    .limit(1)
    .get();

  if (linkSnap.empty) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const linkDoc = linkSnap.docs[0];
  const link = linkDoc.data();

  // Validate resource type
  if (link.resourceType !== 'doc') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Check expiration
  if (link.expiresAt) {
    const expiresMs = link.expiresAt?.seconds
      ? link.expiresAt.seconds * 1000
      : new Date(link.expiresAt).getTime();
    if (Date.now() > expiresMs) {
      return NextResponse.json({ error: 'expired' }, { status: 410 });
    }
  }

  // Check max uses (use transaction to prevent race condition)
  if (link.maxUses !== null && link.maxUses !== undefined && link.useCount >= link.maxUses) {
    return NextResponse.json({ error: 'max_uses' }, { status: 410 });
  }

  // Check password if the link has one
  if (link.password) {
    if (!password || password !== link.password) {
      return NextResponse.json({ error: 'password_required' }, { status: 403 });
    }
  }

  // Fetch the document
  const docSnap = await adminDb.doc(`docs/${link.resourceId}`).get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const docData = docSnap.data()!;

  // Increment use count atomically
  await linkDoc.ref.update({
    useCount: FieldValue.increment(1),
    lastAccessedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Return only safe fields — no internal IDs or metadata
  return NextResponse.json({
    title: docData.title || 'Untitled',
    contentHtml: docData.contentHtml || '',
    content: docData.content || '',
    permission: link.permission,
    createdByName: docData.createdByName || '',
    updatedAt: docData.updatedAt || null,
  });
}

/**
 * GET /api/docs/public?token=<shareToken>
 * For password-free shared docs only.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    // GET requests: password-free access only
    // Password-protected docs MUST use POST to avoid URL-logged credentials
    return fetchSharedDoc(token, null);
  } catch (error: any) {
    console.error('[Public Doc]', error?.message);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }
}

/**
 * POST /api/docs/public
 * Body: { token: string, password: string }
 * For password-protected shared docs — password sent in body, not URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;
    const password = body?.password;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    return fetchSharedDoc(token, password);
  } catch (error: any) {
    console.error('[Public Doc]', error?.message);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }
}
