// ================================================================
// Admin Data Repair API — POST /api/admin/data-repair
// Requires authenticated admin user.
// Body: { action: 'report' | 'repair' | 'clean_relations' | 'repair_goals' | 'clean_subcollections' | 'clean_presence' | 'clean_time_entries' | 'clean_whiteboard_refs' }
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  runIntegrityReport,
  runFullRepair,
  cleanOrphanedRelations,
  repairBrokenGoalTargetLinks,
  cleanOrphanedTaskSubcollections,
  cleanStalePresence,
  cleanOrphanedTimeEntries,
  cleanStaleWhiteboardTaskRefs,
} from '@/lib/data-repair';
import { logActionAdmin } from '@/lib/db-admin';

const VALID_ACTIONS = ['report', 'repair', 'clean_relations', 'repair_goals', 'clean_subcollections', 'clean_presence', 'clean_time_entries', 'clean_whiteboard_refs'] as const;
type RepairAction = typeof VALID_ACTIONS[number];

function apiOk(data: any) { return NextResponse.json(data, { status: 200 }); }
function apiErr(msg: string, status = 500) { return NextResponse.json({ error: msg }, { status }); }

export async function POST(req: NextRequest) {
  try {
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    const rl = await checkRateLimit('data-repair', authedUser.uid, 10);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const action = body?.action as string;

    if (!action || !VALID_ACTIONS.includes(action as RepairAction)) {
      return apiErr(`Unknown action. Use: ${VALID_ACTIONS.join(', ')}`, 400);
    }

    let result: any;
    switch (action as RepairAction) {
      case 'report':
        result = { results: await runIntegrityReport() }; break;
      case 'repair':
        result = { results: await runFullRepair() }; break;
      case 'clean_relations':
        result = { result: await cleanOrphanedRelations() }; break;
      case 'repair_goals':
        result = { result: await repairBrokenGoalTargetLinks() }; break;
      case 'clean_subcollections':
        result = { result: await cleanOrphanedTaskSubcollections() }; break;
      case 'clean_presence':
        result = { result: await cleanStalePresence() }; break;
      case 'clean_time_entries':
        result = { result: await cleanOrphanedTimeEntries() }; break;
      case 'clean_whiteboard_refs':
        result = { result: await cleanStaleWhiteboardTaskRefs() }; break;
    }

    await logActionAdmin({
      action: 'admin_data_repair',
      resource: 'system',
      detail: `Data repair action="${action}" by user ${authedUser.uid}`,
      actorId: authedUser.uid,
      actorName: authedUser.email || authedUser.uid,
    });

    return apiOk(result);
  } catch (err) {
    console.error('[DataRepair] operation failed:', err);
    return apiErr('Internal error', 500);
  }
}
