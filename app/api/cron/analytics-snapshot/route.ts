// ================================================================
// Cron: Daily Analytics Snapshot — precompute and persist metrics
// ================================================================
// Runs daily at 06:00 UTC. Computes org-wide metrics snapshot
// and saves it to orgs/{org}/analyticsSnapshots/{date}.
// This enables time series without full scans.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const ORG = 'solis-center';

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
    const { computeSnapshot } = await import('@/lib/analytics-snapshot');
    const snapshot = await computeSnapshot();

    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await adminDb.doc(`orgs/${ORG}/analyticsSnapshots/${dateKey}`).set({
      ...snapshot,
      savedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, date: dateKey, snapshot });
  } catch (err: any) {
    console.error('[Cron:AnalyticsSnapshot] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
