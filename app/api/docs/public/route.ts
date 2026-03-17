import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/docs/public?token=<shareToken>&password=<optional>
 *
 * Public endpoint — no authentication required.
 * Validates a share link token and returns the document content if valid.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

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

    // Check max uses
    if (link.maxUses !== null && link.maxUses !== undefined && link.useCount >= link.maxUses) {
      return NextResponse.json({ error: 'max_uses' }, { status: 410 });
    }

    // Check password if the link has one
    if (link.password) {
      const providedPassword = req.nextUrl.searchParams.get('password');
      if (providedPassword !== link.password) {
        return NextResponse.json({ error: 'password_required' }, { status: 403 });
      }
    }

    // Fetch the document
    const docSnap = await adminDb.doc(`docs/${link.resourceId}`).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const docData = docSnap.data()!;

    // Increment use count
    await linkDoc.ref.update({
      useCount: (link.useCount || 0) + 1,
      lastAccessedAt: new Date(),
      updatedAt: new Date(),
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
  } catch (error: any) {
    console.error('[Public Doc]', error);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }
}
