import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID } from '@/lib/org';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Rate limit: 20 req/min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = await checkRateLimit('public-dashboard', ip, 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const snap = await adminDb.collection(`orgs/${ORG_ID}/dashboards`)
      .where('publicToken', '==', token)
      .where('isShared', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    // Load latest analytics snapshot if available
    let snapshot = null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const snapshotDoc = await adminDb.doc(`orgs/${ORG_ID}/analyticsSnapshots/${today}`).get();
      if (snapshotDoc.exists) {
        snapshot = snapshotDoc.data();
      } else {
        // Fallback: try yesterday's snapshot
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const yDoc = await adminDb.doc(`orgs/${ORG_ID}/analyticsSnapshots/${yesterday}`).get();
        if (yDoc.exists) {
          snapshot = yDoc.data();
        }
      }
    } catch (err) {
      console.warn('[Public Dashboard] Failed to load snapshot:', err);
    }

    // Load aggregated task/goal counts for widget rendering (no individual records exposed)
    // NOTE: Rate limiting should be implemented at the infrastructure level (e.g., Vercel, Cloudflare)
    let taskCountsByStatus: Record<string, number> = {};
    let goalCountsByStatus: Record<string, number> = {};
    let teams: any[] = [];
    try {
      const [tasksSnap, goalsSnap, teamsSnap] = await Promise.all([
        adminDb.collection('tasks')
          .where('orgId', '==', ORG_ID)
          .where('deleted', '!=', true)
          .limit(500)
          .get(),
        adminDb.collection('goals')
          .where('orgId', '==', ORG_ID)
          .limit(200)
          .get(),
        adminDb.collection(`orgs/${ORG_ID}/teams`).get(),
      ]);

      // Aggregate tasks by status — only expose counts, not individual records
      for (const d of tasksSnap.docs) {
        const status = d.data().status || 'unknown';
        taskCountsByStatus[status] = (taskCountsByStatus[status] || 0) + 1;
      }

      // Aggregate goals by status — only expose counts, not individual records
      for (const d of goalsSnap.docs) {
        const status = d.data().status || 'unknown';
        goalCountsByStatus[status] = (goalCountsByStatus[status] || 0) + 1;
      }

      teams = teamsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.id,
        color: d.data().color || '#6B7280',
      }));
    } catch (err) {
      console.warn('[Public Dashboard] Failed to load data for widgets:', err);
    }

    // Return only safe fields — aggregated counts, no individual task/goal data
    return NextResponse.json({
      id: doc.id,
      title: data.title,
      widgets: data.widgets || [],
      shareMode: data.shareMode || 'view',
      snapshot,
      taskCountsByStatus,
      goalCountsByStatus,
      teams,
    });
  } catch (error: any) {
    console.error('[Public Dashboard]', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
