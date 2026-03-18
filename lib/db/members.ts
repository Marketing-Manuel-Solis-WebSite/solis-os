// ===== MEMBERS & ORG =====

import {
  collection, getDocs, getCountFromServer, query, where,
  addTo, setAt, updateAt, getOne,
  db, ORG,
} from './helpers';

// ===== MEMBERS =====
export async function getMembers() {
  const s = await getDocs(collection(db, `orgs/${ORG}/members`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }
export async function updateMember(uid: string, data: any) { return updateAt(`orgs/${ORG}/members/${uid}`, data); }
export async function createMember(uid: string, data: any) {
  return setAt(`orgs/${ORG}/members/${uid}`, {
    userId: uid, orgId: ORG,
    role: data.role || 'member',
    teamId: data.teamId || '',
    teamIds: data.teamId ? [data.teamId] : [],
    displayName: data.displayName || '',
    email: data.email || '',
    title: data.title || '',
    department: data.department || '',
    managerId: data.managerId || '',
    hierarchyLevel: data.hierarchyLevel || 'member',
    photoURL: data.photoURL || '',
    active: true,
  });
}
export async function softDeleteMember(uid: string) { return updateAt(`orgs/${ORG}/members/${uid}`, { active: false }); }

// Dry-run: count resources assigned to a member that would become orphaned on deactivation
export async function getMemberImpact(uid: string) {
  const counts: Record<string, number> = {};
  const cols = ['tasks', 'goals', 'docs', 'time-entries'] as const;
  const promises = cols.map(async (col) => {
    const field = col === 'time-entries' ? 'userId' : 'assignees';
    const op = field === 'assignees' ? 'array-contains' : '==';
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where(field, op, uid));
    const snap = await getCountFromServer(q_);
    counts[col] = snap.data().count;
  });
  await Promise.all(promises);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}
export async function reactivateMember(uid: string) { return updateAt(`orgs/${ORG}/members/${uid}`, { active: true }); }

// ===== ORG =====
export async function getOrg() { return getOne(`orgs/${ORG}`); }
export async function updateOrg(data: any) { return setAt(`orgs/${ORG}`, data); }
