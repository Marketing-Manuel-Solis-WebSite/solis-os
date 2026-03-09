// ================================================================
// Admin Data Repair API — POST /api/admin/data-repair
// Requires authenticated admin user.
// Body: { action: 'report' | 'repair' | 'clean_relations' | 'repair_goals' | 'clean_subcollections' | 'clean_presence' }
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/server-auth';
import {
  runIntegrityReport,
  runFullRepair,
  cleanOrphanedRelations,
  repairBrokenGoalTargetLinks,
  cleanOrphanedTaskSubcollections,
  cleanStalePresence,
} from '@/lib/data-repair';

const VALID_ACTIONS = ['report', 'repair', 'clean_relations', 'repair_goals', 'clean_subcollections', 'clean_presence'] as const;
type RepairAction = typeof VALID_ACTIONS[number];

function apiOk(data: any) { return NextResponse.json(data, { status: 200 }); }
function apiErr(msg: string, status = 500) { return NextResponse.json({ error: msg }, { status }); }

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateAdmin(req);
    if (!user) return apiErr('Unauthorized – admin role required', 403);

    const body = await req.json();
    const action = body?.action as string;

    if (!action || !VALID_ACTIONS.includes(action as RepairAction)) {
      return apiErr(`Unknown action: "${action ?? ''}". Use: ${VALID_ACTIONS.join(', ')}`, 400);
    }

    switch (action as RepairAction) {
      case 'report':
        return apiOk({ results: await runIntegrityReport() });
      case 'repair':
        return apiOk({ results: await runFullRepair() });
      case 'clean_relations':
        return apiOk({ result: await cleanOrphanedRelations() });
      case 'repair_goals':
        return apiOk({ result: await repairBrokenGoalTargetLinks() });
      case 'clean_subcollections':
        return apiOk({ result: await cleanOrphanedTaskSubcollections() });
      case 'clean_presence':
        return apiOk({ result: await cleanStalePresence() });
    }
  } catch {
    return apiErr('Internal error', 500);
  }
}
