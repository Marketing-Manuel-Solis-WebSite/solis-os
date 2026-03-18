import 'server-only';

import { adminDb, FieldValue, ORG, setAt, updateAt, deleteAt, getOne } from './helpers';

const TEAM_RESOURCE_COLLECTIONS = ['tasks', 'goals', 'docs', 'channels', 'forms', 'time-entries', 'whiteboards', 'automations'] as const;

export { TEAM_RESOURCE_COLLECTIONS };

export async function createTeam(data: any) {
  const id = data.id || data.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  await setAt(`orgs/${ORG}/teams/${id}`, {
    name: data.name,
    color: data.color || '#6B7280',
    icon: data.icon || '📁',
    description: data.description || '',
    status: 'active',
  });
  // Auto-create required 'list' view for every new space
  try {
    await adminDb.collection(`orgs/${ORG}/views`).add({
      orgId: ORG,
      scopeType: 'space',
      scopeId: id,
      name: 'Lista',
      viewType: 'list',
      visibility: 'required',
      isDefault: true,
      isPinned: false,
      position: 0,
      config: {},
      sharedWith: [],
      createdBy: data.createdBy || 'system',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[createTeam] Auto-create required list view failed:', err);
  }
  return id;
}

export async function updateTeam(id: string, data: any) { return updateAt(`orgs/${ORG}/teams/${id}`, data); }

export async function deleteTeamAdmin(id: string) { return deleteAt(`orgs/${ORG}/teams/${id}`); }

export async function reassignTeamResourcesAdmin(fromTeamId: string, toTeamId: string, toTeamName: string) {
  let moved = 0;
  const BATCH_LIMIT = 500;

  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const snap = await adminDb.collection(col)
      .where('orgId', '==', ORG)
      .where('teamId', '==', fromTeamId)
      .get();
    if (snap.empty) continue;

    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
      for (const d of chunk) {
        batch.update(adminDb.doc(`${col}/${d.id}`), { teamId: toTeamId, updatedAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
      moved += chunk.length;
    }
  }

  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  // Primary members: teamId matches
  const primaryMembers = membersSnap.docs.filter(d => d.data().teamId === fromTeamId);
  for (let i = 0; i < primaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = primaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      const newIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newIds.includes(toTeamId)) newIds.push(toTeamId);
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamId: toTeamId, teamIds: newIds, department: toTeamName, updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    moved += chunk.length;
  }
  // Secondary members: teamIds array contains fromTeamId but teamId is different
  const secondaryMembers = membersSnap.docs.filter(d => {
    const data = d.data();
    return data.teamId !== fromTeamId && (data.teamIds || []).includes(fromTeamId);
  });
  for (let i = 0; i < secondaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = secondaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      const newIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newIds.includes(toTeamId)) newIds.push(toTeamId);
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamIds: newIds, updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    moved += chunk.length;
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
    if (snap.empty) continue;

    // Tasks and goals require cascade delete (subcollections), so they
    // must be deleted individually. All other collections use batch writes.
    if (col === 'tasks') {
      const { deleteTask } = await import('./tasks');
      for (const d of snap.docs) { await deleteTask(d.id); deleted++; }
    } else if (col === 'goals') {
      const { deleteGoal } = await import('./goals');
      for (const d of snap.docs) { await deleteGoal(d.id); deleted++; }
    } else {
      // Firestore batches support up to 500 operations
      const BATCH_LIMIT = 500;
      for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
        const batch = adminDb.batch();
        const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
        for (const d of chunk) {
          batch.delete(adminDb.doc(`${col}/${d.id}`));
        }
        await batch.commit();
        deleted += chunk.length;
      }
    }
  }

  // Batch-update members to detach from deleted team
  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  const BATCH_LIMIT = 500;
  // Primary members: teamId matches — clear teamId, department, filter teamIds
  const primaryMembers = membersSnap.docs.filter(d => d.data().teamId === teamId);
  for (let i = 0; i < primaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = primaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamId: '', teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), department: '', updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  // Secondary members: teamIds contains teamId but teamId is different — just filter teamIds
  const secondaryMembers = membersSnap.docs.filter(d => {
    const data = d.data();
    return data.teamId !== teamId && (data.teamIds || []).includes(teamId);
  });
  for (let i = 0; i < secondaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = secondaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return deleted;
}

// ===== LISTS =====
export async function getList(id: string) { return getOne(`lists/${id}`); }
