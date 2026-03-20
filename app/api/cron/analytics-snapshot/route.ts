// ================================================================
// Cron: Daily Analytics Snapshot — precompute and persist metrics
// ================================================================
// Runs daily at 06:00 UTC. Tries incremental first (reads yesterday's
// snapshot + counts deltas). Falls back to full recompute if no
// previous snapshot or delta > 20%.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';
import { logActionAdmin } from '@/lib/db-admin';



export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Try incremental first, then fall back to full
    const { computeSnapshotIncremental } = await import('@/lib/analytics-snapshot-incremental');

    const { snapshot, incremental, deltaCount } = await computeSnapshotIncremental();

    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await adminDb.doc(`orgs/${ORG}/analyticsSnapshots/${dateKey}`).set({
      ...snapshot,
      savedAt: FieldValue.serverTimestamp(),
      _incremental: incremental,
      _deltaCount: deltaCount ?? null,
    });

    await logActionAdmin({
      action: 'cron_analytics_snapshot',
      resource: 'analyticsSnapshots',
      detail: `Snapshot saved for ${dateKey}, incremental=${incremental}, deltaCount=${deltaCount ?? 'n/a'}`,
      actorId: 'system',
      actorName: 'Cron: analytics-snapshot',
    });

    return NextResponse.json({ ok: true, date: dateKey, incremental, deltaCount, snapshot });
  } catch (err: any) {
    console.error('[Cron:AnalyticsSnapshot] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
