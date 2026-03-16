// ================================================================
// Time Tracking — Approval Workflow
// ================================================================
// Adds approval status to time entries. Managers can approve or
// reject submitted time entries before they count toward billing.

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';

// ---- Types ----

export type TimeApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface TimeApprovalEntry {
  id: string;
  userId: string;
  taskId: string;
  date: string;
  hours: number;
  minutes: number;
  description: string;
  billable: boolean;
  teamId: string;
  approvalStatus: TimeApprovalStatus;
  approvedBy?: string;
  approvalComment?: string;
  approvalDate?: string;
  submittedAt?: string;
}

// ---- Functions ----

/**
 * Submit a time entry for approval. Sets approvalStatus to 'pending'.
 */
export async function submitForApproval(entryId: string): Promise<void> {
  await adminDb.collection('time-entries').doc(entryId).update({
    approvalStatus: 'pending',
    submittedAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Approve a time entry. Sets approvalStatus to 'approved'.
 */
export async function approveTimeEntry(
  entryId: string,
  approvedBy: string,
  comment?: string,
): Promise<void> {
  await adminDb.collection('time-entries').doc(entryId).update({
    approvalStatus: 'approved',
    approvedBy,
    approvalComment: comment || '',
    approvalDate: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Reject a time entry. Sets approvalStatus to 'rejected'.
 */
export async function rejectTimeEntry(
  entryId: string,
  rejectedBy: string,
  comment?: string,
): Promise<void> {
  await adminDb.collection('time-entries').doc(entryId).update({
    approvalStatus: 'rejected',
    approvedBy: rejectedBy,
    approvalComment: comment || '',
    approvalDate: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Get all pending approval entries for the org, optionally filtered by team.
 */
export async function getPendingApprovals(teamId?: string): Promise<TimeApprovalEntry[]> {
  let q = adminDb.collection('time-entries')
    .where('orgId', '==', ORG)
    .where('approvalStatus', '==', 'pending');

  if (teamId) {
    q = q.where('teamId', '==', teamId);
  }

  const snap = await q.get();

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId || '',
      taskId: data.taskId || '',
      date: data.date || '',
      hours: data.hours || 0,
      minutes: data.minutes || 0,
      description: data.description || '',
      billable: data.billable || false,
      teamId: data.teamId || '',
      approvalStatus: data.approvalStatus || 'pending',
      approvedBy: data.approvedBy,
      approvalComment: data.approvalComment,
      approvalDate: data.approvalDate,
      submittedAt: data.submittedAt,
    };
  });
}
