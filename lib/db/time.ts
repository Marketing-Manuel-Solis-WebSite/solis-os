// ===========================================================
// TIME ENTRIES (Timesheets)
// ===========================================================

import {
  collection, getDocs, query, where,
  addTo, updateAt, deleteAt, getByOrg, getByTeam,
  db, ORG,
} from './helpers';

export async function getTimeEntries(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('time-entries', teamId, maxResults);
  return getByOrg('time-entries', maxResults);
}

export async function getTimeEntriesByDateRange(startDate: string, endDate: string, userId?: string) {
  let q;
  if (userId) {
    q = query(
      collection(db, 'time-entries'),
      where('orgId', '==', ORG),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('userId', '==', userId)
    );
  } else {
    q = query(
      collection(db, 'time-entries'),
      where('orgId', '==', ORG),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
  }
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTimeEntriesByTask(taskId: string) {
  const q = query(
    collection(db, 'time-entries'),
    where('orgId', '==', ORG),
    where('taskId', '==', taskId)
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

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

// Recalculate task.timeSpent from all time entries (idempotent)
export async function syncTaskTimeSpent(taskId: string) {
  if (!taskId) return;
  const entries = await getTimeEntriesByTask(taskId);
  const totalMinutes = entries.reduce((sum: number, e: any) => sum + ((e.hours || 0) * 60 + (e.minutes || 0)), 0);
  await updateAt(`tasks/${taskId}`, { timeSpent: totalMinutes });
}
