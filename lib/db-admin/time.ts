import 'server-only';

import { adminDb, ORG, addTo, updateAt, deleteAt, getOne, getByOrg, getByTeam } from './helpers';

// ===== TIME ENTRIES =====
export async function getTimeEntries(teamId?: string) {
  if (teamId) return getByTeam('time-entries', teamId);
  return getByOrg('time-entries');
}

export async function getTimeEntriesByDateRange(startDate: string, endDate: string, userId?: string) {
  let q = adminDb.collection('time-entries')
    .where('orgId', '==', ORG)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate);
  if (userId) {
    q = q.where('userId', '==', userId);
  }
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTimeEntry(id: string) { return getOne(`time-entries/${id}`); }

export async function createTimeEntry(data: any) {
  return addTo('time-entries', {
    orgId: ORG,
    userId: data.userId || '',
    userName: data.userName || '',
    taskId: data.taskId || '',
    taskTitle: data.taskTitle || '',
    date: data.date || '',
    hours: data.hours || 0,
    minutes: data.minutes || 0,
    notes: data.notes || '',
    billable: data.billable ?? false,
    teamId: data.teamId || '',
    createdBy: data.createdBy || '',
  });
}

export async function updateTimeEntry(id: string, data: any) { return updateAt(`time-entries/${id}`, data); }
export async function deleteTimeEntry(id: string) { return deleteAt(`time-entries/${id}`); }

// Recalculate task.timeSpent from all time entries (transactional, idempotent, admin SDK)
export async function syncTaskTimeSpentAdmin(taskId: string) {
  if (!taskId) return;
  const taskRef = adminDb.doc(`tasks/${taskId}`);
  await adminDb.runTransaction(async (txn) => {
    // Read task inside transaction to ensure atomicity
    await txn.get(taskRef);
    // Query all time entries for this task
    const snap = await adminDb.collection('time-entries')
      .where('orgId', '==', ORG)
      .where('taskId', '==', taskId)
      .get();
    const totalMinutes = snap.docs.reduce((sum, d) => {
      const e = d.data();
      return sum + ((e.hours || 0) * 60 + (e.minutes || 0));
    }, 0);
    txn.update(taskRef, { timeSpent: totalMinutes });
  });
}
