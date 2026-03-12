// ================================================================
// Analytics Snapshot API — Server-side metric aggregation
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { computeSnapshot } from '@/lib/analytics-snapshot';

export async function GET(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await computeSnapshot();
    return NextResponse.json({ data: snapshot, error: null });
  } catch (err: any) {
    console.error('[Analytics Snapshot] error:', err);
    return NextResponse.json({ data: null, error: 'Failed to compute analytics' }, { status: 500 });
  }
}
