// ================================================================
// Analytics Time Series API — read historical snapshots
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG, getOrgIdFromRequest } from '@/lib/org';



export async function GET(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10) || 30, 90);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = cutoff.toISOString().split('T')[0];

    const snap = await adminDb.collection(`orgs/${ORG}/analyticsSnapshots`)
      .where('__name__', '>=', cutoffKey)
      .orderBy('__name__', 'asc')
      .limit(days)
      .get();

    const series = snap.docs.map(d => ({
      date: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ data: series, error: null });
  } catch (err: any) {
    console.error('[Analytics TimeSeries] error:', err);
    return NextResponse.json({ data: null, error: 'Failed to load time series' }, { status: 500 });
  }
}
