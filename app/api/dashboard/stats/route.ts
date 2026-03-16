// ================================================================
// GET /api/dashboard/stats — Lightweight dashboard statistics
// ================================================================
// Uses Firestore .count().get() aggregation — zero documents loaded.
// Returns counts for dashboard widgets without transferring task data.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { countQuery } from '@/lib/firestore-batch-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const teamId = url.searchParams.get('teamId');

  try {
    let baseQuery = adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where('deleted', '!=', true);

    if (teamId && teamId !== '__all__') {
      baseQuery = baseQuery.where('teamId', '==', teamId) as FirebaseFirestore.Query;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const [totalTasks, completedTasks, inProgressTasks, totalGoals] = await Promise.all([
      countQuery(baseQuery),
      countQuery(baseQuery.where('status', 'in', ['done', 'completed'])),
      countQuery(baseQuery.where('status', '==', 'in_progress')),
      countQuery(
        teamId && teamId !== '__all__'
          ? adminDb.collection('goals').where('orgId', '==', ORG).where('teamId', '==', teamId)
          : adminDb.collection('goals').where('orgId', '==', ORG)
      ),
    ]);

    return NextResponse.json({
      totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      totalGoals,
    });
  } catch (err: any) {
    console.error('[API:dashboard/stats] error:', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
