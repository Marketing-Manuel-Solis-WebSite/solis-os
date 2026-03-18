import 'server-only';

import { adminDb, ORG, membersCache, teamsCache, getOne } from './helpers';

// ===== CUSTOM FIELD DEFINITIONS (admin SDK) =====
export async function getCustomFieldDefs(): Promise<any[]> {
  const snap = await adminDb.doc(`orgs/${ORG}/settings/customFields`).get();
  if (!snap.exists) return [];
  return (snap.data() as any)?.fields || [];
}

// ===== MEMBERS =====
export async function getMembers() {
  const cached = membersCache.get(ORG);
  if (cached) return cached;
  const snap = await adminDb.collection(`orgs/${ORG}/members`).get();
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  membersCache.set(ORG, result);
  return result;
}

export function invalidateMembersCache() { membersCache.invalidate(ORG); }

export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }

// ===== TEAMS / DEPARTMENTS =====
export async function getTeams() {
  const cached = teamsCache.get(ORG);
  if (cached) return cached;
  const snap = await adminDb.collection(`orgs/${ORG}/teams`).get();
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  teamsCache.set(ORG, result);
  return result;
}

export function invalidateTeamsCache() { teamsCache.invalidate(ORG); }

export async function getTeam(id: string) { return getOne(`orgs/${ORG}/teams/${id}`); }
