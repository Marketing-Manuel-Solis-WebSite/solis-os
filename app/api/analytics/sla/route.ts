// ================================================================
// Analytics SLA API — Response & resolution time metrics
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { computeSLAMetrics } from '@/lib/analytics-sla';

export async function GET(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const teamId = searchParams.get('teamId') || undefined;

    const metrics = await computeSLAMetrics({ startDate, endDate, teamId });
    return NextResponse.json({ data: metrics, error: null });
  } catch (err: any) {
    console.error('[Analytics SLA] error:', err);
    return NextResponse.json({ data: null, error: 'Failed to compute SLA metrics' }, { status: 500 });
  }
}
