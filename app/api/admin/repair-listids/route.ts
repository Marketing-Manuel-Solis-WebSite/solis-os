/**
 * Data Repair API: Fix legacy tasks with cross-space listId
 *
 * GET  /api/admin/repair-listids?mode=dry-run  — report only
 * POST /api/admin/repair-listids               — apply fixes (set listId=null)
 *
 * Requires admin role (via requireAdmin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';
import { ORG_ID as ORG } from '@/lib/org';



async function findViolations() {
  // Build listId -> spaceId map
  const listsSnap = await adminDb.collection('lists').where('orgId', '==', ORG).get();
  const listSpaceMap = new Map<string, string>();
  for (const doc of listsSnap.docs) {
    listSpaceMap.set(doc.id, doc.data().spaceId || '');
  }

  // Find all tasks with non-null listId
  const tasksSnap = await adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('listId', '!=', null)
    .get();

  const violations: { taskId: string; teamId: string; listId: string; listSpaceId: string | null; reason: string }[] = [];

  for (const doc of tasksSnap.docs) {
    const data = doc.data();
    const taskTeamId = data.teamId || '';
    const listId = data.listId;
    if (!listId) continue;

    const listSpaceId = listSpaceMap.get(listId);
    if (listSpaceId === undefined) {
      violations.push({ taskId: doc.id, teamId: taskTeamId, listId, listSpaceId: null, reason: 'LIST_NOT_FOUND' });
    } else if (listSpaceId !== taskTeamId) {
      violations.push({ taskId: doc.id, teamId: taskTeamId, listId, listSpaceId, reason: 'CROSS_SPACE' });
    }
  }

  return { totalTasks: tasksSnap.size, totalLists: listSpaceMap.size, violations };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof Response) return auth;

    const result = await findViolations();
    return NextResponse.json({
      mode: 'dry-run',
      totalTasks: result.totalTasks,
      totalLists: result.totalLists,
      violationCount: result.violations.length,
      violations: result.violations,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof Response) return auth;

    const result = await findViolations();
    if (result.violations.length === 0) {
      return NextResponse.json({ mode: 'live', repaired: 0, message: 'No violations found. Data is clean.' });
    }

    // Apply repairs in batches of 500
    const BATCH_SIZE = 500;
    let repaired = 0;
    for (let i = 0; i < result.violations.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = result.violations.slice(i, i + BATCH_SIZE);
      for (const v of chunk) {
        batch.update(adminDb.collection('tasks').doc(v.taskId), { listId: null });
      }
      await batch.commit();
      repaired += chunk.length;
    }

    return NextResponse.json({
      mode: 'live',
      repaired,
      violations: result.violations,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
