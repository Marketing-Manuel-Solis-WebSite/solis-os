// ================================================================
// Server-side DB helpers using Firebase Admin SDK
// Mirrors functions from lib/db.ts used by API routes only.
// Client components continue using lib/db.ts (client SDK).
// ================================================================

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const ORG = 'solis-center';

// ===== GENERIC HELPERS =====

async function addTo(path: string, data: any) {
  const ref = await adminDb.collection(path).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref;
}

async function setAt(path: string, data: any) {
  await adminDb.doc(path).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

async function updateAt(path: string, data: any) {
  await adminDb.doc(path).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

async function deleteAt(path: string) {
  await adminDb.doc(path).delete();
}

async function getOne(path: string) {
  const snap = await adminDb.doc(path).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getByOrg(col: string, maxResults = 500) {
  const snap = await adminDb
    .collection(col)
    .where('orgId', '==', ORG)
    .limit(maxResults)
    .get();
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return results.sort((a: any, b: any) => {
    const ta = a.createdAt?.seconds || a.createdAt?._seconds || 0;
    const tb = b.createdAt?.seconds || b.createdAt?._seconds || 0;
    return tb - ta;
  });
}

async function getByTeam(col: string, teamId: string) {
  const all = await getByOrg(col);
  if (teamId === '__all__') return all;
  return all.filter((d: any) => d.teamId === teamId);
}

// ===== MEMBERS =====
export async function getMembers() {
  const snap = await adminDb.collection(`orgs/${ORG}/members`).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }

// ===== TEAMS / DEPARTMENTS =====
export async function getTeams() {
  const snap = await adminDb.collection(`orgs/${ORG}/teams`).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTeam(id: string) { return getOne(`orgs/${ORG}/teams/${id}`); }

export async function createTeam(data: any) {
  const id = data.id || data.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  await setAt(`orgs/${ORG}/teams/${id}`, {
    name: data.name,
    color: data.color || '#6B7280',
    icon: data.icon || '📁',
    description: data.description || '',
    status: 'active',
  });
  return id;
}

export async function updateTeam(id: string, data: any) { return updateAt(`orgs/${ORG}/teams/${id}`, data); }

export async function deleteTeamAdmin(id: string) { return deleteAt(`orgs/${ORG}/teams/${id}`); }

const TEAM_RESOURCE_COLLECTIONS = ['tasks', 'goals', 'docs', 'channels', 'forms', 'time-entries', 'whiteboards', 'automations'] as const;

export async function reassignTeamResourcesAdmin(fromTeamId: string, toTeamId: string, toTeamName: string) {
  let moved = 0;
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const snap = await adminDb.collection(col)
      .where('orgId', '==', ORG)
      .where('teamId', '==', fromTeamId)
      .get();
    for (const d of snap.docs) {
      await adminDb.doc(`${col}/${d.id}`).update({ teamId: toTeamId, updatedAt: FieldValue.serverTimestamp() });
      moved++;
    }
  }
  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  for (const d of membersSnap.docs) {
    const data = d.data();
    if (data.teamId === fromTeamId) {
      const newIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newIds.includes(toTeamId)) newIds.push(toTeamId);
      await adminDb.doc(`orgs/${ORG}/members/${d.id}`).update({
        teamId: toTeamId, teamIds: newIds, department: toTeamName, updatedAt: FieldValue.serverTimestamp(),
      });
      moved++;
    }
  }
  return moved;
}

export async function purgeTeamResourcesAdmin(teamId: string) {
  let deleted = 0;
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const snap = await adminDb.collection(col)
      .where('orgId', '==', ORG)
      .where('teamId', '==', teamId)
      .get();
    for (const d of snap.docs) {
      await adminDb.doc(`${col}/${d.id}`).delete();
      deleted++;
    }
  }
  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  for (const d of membersSnap.docs) {
    const data = d.data();
    if (data.teamId === teamId) {
      await adminDb.doc(`orgs/${ORG}/members/${d.id}`).update({
        teamId: '', teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), department: '', updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
  return deleted;
}

// ===== TASKS =====
export async function getTasks(teamId?: string) {
  if (teamId) return getByTeam('tasks', teamId);
  return getByOrg('tasks');
}

export async function getTask(id: string) { return getOne(`tasks/${id}`); }

export async function createTask(data: any) {
  return addTo('tasks', {
    ...data, orgId: ORG, status: data.status || 'todo', priority: data.priority || 'medium',
    assignees: data.assignees || [], tags: data.tags || [], teamId: data.teamId || '',
    visibility: data.visibility || 'team',
    description: data.description || '', dueDate: data.dueDate || null, startDate: data.startDate || null,
    timeEstimate: data.timeEstimate || null, timeSpent: data.timeSpent || 0,
    subtasks: data.subtasks || [], checklist: data.checklist || [], attachments: data.attachments || [],
    customFields: data.customFields || {}, type: data.type || 'task', points: data.points || null,
    dependencies: data.dependencies || [], watchers: data.watchers || [], archived: false,
    createdBy: data.createdBy || '',
  });
}

export async function updateTask(id: string, data: any) { return updateAt(`tasks/${id}`, data); }
export async function deleteTask(id: string) { return deleteAt(`tasks/${id}`); }

// ===== GOALS =====
export async function getGoals(teamId?: string) {
  if (teamId) return getByTeam('goals', teamId);
  return getByOrg('goals');
}

export async function getGoal(id: string) { return getOne(`goals/${id}`); }

export async function createGoal(data: any) {
  return addTo('goals', {
    orgId: ORG,
    name: data.name || '',
    description: data.description || '',
    dueDate: data.dueDate || null,
    ownerId: data.ownerId || '',
    ownerName: data.ownerName || '',
    teamId: data.teamId || '',
    status: data.status || 'on_track',
    progress: 0,
    tags: data.tags || [],
    color: data.color || '#7B68EE',
    visibility: data.visibility || 'team',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
  });
}

export async function updateGoal(id: string, data: any) { return updateAt(`goals/${id}`, data); }
export async function deleteGoal(id: string) { return deleteAt(`goals/${id}`); }

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

// ===== FORMS =====
export async function getForm(id: string) { return getOne(`forms/${id}`); }

export async function getFormByToken(token: string) {
  const snap = await adminDb.collection('forms')
    .where('publicToken', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function updateForm(formId: string, data: any) { return updateAt(`forms/${formId}`, data); }

export async function createFormSubmission(formId: string, data: any) {
  return addTo(`forms/${formId}/submissions`, {
    values: data.values || {},
    ip: data.ip || null,
    userAgent: data.userAgent || null,
    utmSource: data.utmSource || '',
    utmMedium: data.utmMedium || '',
    utmCampaign: data.utmCampaign || '',
    referrer: data.referrer || '',
    attachments: data.attachments || [],
    status: 'new',
    reviewedBy: '',
    reviewedAt: null,
    notes: '',
    assignedTo: '',
    convertedToType: null,
    convertedToId: null,
    convertedAt: null,
    convertedBy: null,
    consentGiven: data.consentGiven ?? false,
  });
}

export async function getFormSubmissions(formId: string) {
  const snap = await adminDb.collection(`forms/${formId}/submissions`)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ===== NOTIFICATIONS (server-side) =====

export async function createNotificationAdmin(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  actorId?: string;
  actorName?: string;
}) {
  return adminDb.collection(`orgs/${ORG}/notifications`).add({
    ...data,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function notifyManyAdmin(
  userIds: string[],
  data: Omit<Parameters<typeof createNotificationAdmin>[0], 'userId'>,
) {
  return Promise.all(userIds.map(userId => createNotificationAdmin({ ...data, userId })));
}

export { ORG };
