// ================================================================
// Analytics Velocity API — Weekly throughput data
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { computeVelocity } from '@/lib/analytics-burndown';

export async function GET(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weeks = Math.min(Math.max(parseInt(searchParams.get('weeks') || '8', 10) || 8, 2), 26);
    const teamId = searchParams.get('teamId') || undefined;

    const velocity = await computeVelocity(weeks, { teamId });
    return NextResponse.json({ data: velocity, error: null });
  } catch (err: any) {
    console.error('[Analytics Velocity] error:', err);
    return NextResponse.json({ data: null, error: 'Failed to compute velocity' }, { status: 500 });
  }
}
