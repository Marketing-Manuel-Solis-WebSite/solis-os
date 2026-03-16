// ================================================================
// GET /api/tasks/filtered — Server-side filtered & paginated tasks
// ================================================================
// Pushes all filters to Firestore queries for scalability.
// Returns cursor-paginated results.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { queryTasksPaginated } from '@/lib/db-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const teamId = url.searchParams.get('teamId');
  const assignee = url.searchParams.get('assignee');
  const dueBefore = url.searchParams.get('dueBefore');
  const dueAfter = url.searchParams.get('dueAfter');
  const cursor = url.searchParams.get('cursor');
  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(limitParam, 1), 200);

  try {
    const result = await queryTasksPaginated({
      limit,
      cursor,
      status,
      priority,
      teamId,
      assignee,
      dueBefore,
      dueAfter,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API:tasks/filtered] error:', err);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
