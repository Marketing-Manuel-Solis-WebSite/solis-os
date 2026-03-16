// ================================================================
// Time Approvals API — manage time entry approval workflow
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import {
  submitForApproval,
  approveTimeEntry,
  rejectTimeEntry,
  getPendingApprovals,
} from '@/lib/time-approval';

const MANAGER_ROLES = ['manager', 'admin', 'owner'];

async function getUserRole(uid: string): Promise<string | null> {
  try {
    const memberDoc = await adminDb.collection(`orgs/${ORG}/members`).doc(uid).get();
    if (!memberDoc.exists) return null;
    return (memberDoc.data()?.role as string) || null;
  } catch {
    return null;
  }
}

export const runtime = 'nodejs';

// GET: list pending approvals
export async function GET(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole(authedUser.uid);
    if (!role || !MANAGER_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Manager role required' }, { status: 403 });
    }

    const teamId = req.nextUrl.searchParams.get('teamId') || undefined;
    const entries = await getPendingApprovals(teamId);

    return NextResponse.json({ entries });
  } catch (err: any) {
    console.error('[TimeApprovals] GET error:', err);
    return NextResponse.json({ error: 'Failed to load approvals' }, { status: 500 });
  }
}

// POST: submit a time entry for approval
export async function POST(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entryId } = body;

    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    }

    // Verify the caller owns this time entry
    const entryDoc = await adminDb.collection('time-entries').doc(entryId).get();
    if (!entryDoc.exists) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }
    if (entryDoc.data()?.userId !== authedUser.uid) {
      return NextResponse.json({ error: 'You can only submit your own time entries' }, { status: 403 });
    }

    await submitForApproval(entryId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[TimeApprovals] POST error:', err);
    return NextResponse.json({ error: 'Failed to submit for approval' }, { status: 500 });
  }
}

// PATCH: approve or reject a time entry
export async function PATCH(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole(authedUser.uid);
    if (!role || !MANAGER_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Manager role required' }, { status: 403 });
    }

    const body = await req.json();
    const { entryId, action, comment } = body;

    if (!entryId || !action) {
      return NextResponse.json({ error: 'entryId and action are required' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    if (action === 'approve') {
      await approveTimeEntry(entryId, authedUser.uid, comment);
    } else {
      await rejectTimeEntry(entryId, authedUser.uid, comment);
    }

    return NextResponse.json({ ok: true, action });
  } catch (err: any) {
    console.error('[TimeApprovals] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
