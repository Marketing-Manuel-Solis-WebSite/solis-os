// ===========================================================
// SETTINGS, AUTOMATIONS, AUDIT, TEMPLATES, WORKSPACES, PREFS
// ===========================================================

import {
  collection, getDocs, query, orderBy, limit,
  addTo, setAt, updateAt, deleteAt, getOne, getByOrg, getByTeam, deleteSubcollectionDocs,
  db, ORG,
} from './helpers';
import type { DocumentData } from './helpers';

// ===========================================================
// AUTOMATIONS
// ===========================================================
export async function getAutomations(teamId?: string, maxResults = 500) { if (teamId) return getByTeam('automations', teamId, maxResults); return getByOrg('automations', maxResults); }
export async function createAutomation(data: any) { return addTo('automations', { ...data, orgId: ORG, enabled: true, teamId: data.teamId || '' }); }
export async function updateAutomation(id: string, data: any) { return updateAt(`automations/${id}`, data); }
export async function deleteAutomation(id: string) {
  await deleteSubcollectionDocs(`automations/${id}`, 'logs').catch(err => console.error('[DB] Failed to delete automation logs:', err?.message));
  return deleteAt(`automations/${id}`);
}
export async function getAutomationLogs(automationId: string, limitCount = 20) {
  const q = query(collection(db, `automations/${automationId}/logs`), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d: DocumentData) => ({ id: d.id, ...d.data() }));
}

// ===== AUDIT LOG =====
export async function getAuditLogs() { return getByOrg('auditLogs'); }
export async function logAction(data: { action: string; resource: string; detail: string; actorId: string; actorName: string }) {
  return addTo('auditLogs', { ...data, orgId: ORG });
}

// ===== SETTINGS =====
export async function getSettings(key: string) { return getOne(`orgs/${ORG}/settings/${key}`); }
export async function saveSettings(key: string, data: any) { return setAt(`orgs/${ORG}/settings/${key}`, data); }

// ===== SHARED SPACE VIEWS =====
export async function getSharedSpaceViews(spaceId: string) {
  return getOne(`orgs/${ORG}/spaceSharedViews/${spaceId}`);
}
export async function saveSharedSpaceViews(spaceId: string, data: any) {
  return setAt(`orgs/${ORG}/spaceSharedViews/${spaceId}`, data);
}

// ===== SPACE DEFAULT VIEW =====
export async function getSpaceDefaultView(spaceId: string): Promise<string | null> {
  const doc = await getOne(`orgs/${ORG}/teams/${spaceId}/settings/defaultView`);
  return (doc as any)?.viewType || null;
}
export async function setSpaceDefaultView(spaceId: string, viewType: string): Promise<void> {
  await setAt(`orgs/${ORG}/teams/${spaceId}/settings/defaultView`, { viewType });
}

// ===== SPACE DEFAULT TAB =====
export async function getSpaceDefaultTab(spaceId: string): Promise<string | null> {
  const d = await getOne(`orgs/${ORG}/teams/${spaceId}/settings/defaultTab`);
  return (d as any)?.tab || null;
}
export async function setSpaceDefaultTab(spaceId: string, tab: string): Promise<void> {
  await setAt(`orgs/${ORG}/teams/${spaceId}/settings/defaultTab`, { tab });
}

// ===== USER PREFERENCES =====
export async function getUserPreferences(userId: string, key: string) {
  return getOne(`orgs/${ORG}/members/${userId}/preferences/${key}`);
}
export async function saveUserPreferences(userId: string, key: string, data: any) {
  return setAt(`orgs/${ORG}/members/${userId}/preferences/${key}`, data);
}

// ===== WORKSPACES =====
export async function getWorkspaces() { return getByOrg('workspaces'); }
export async function createWorkspace(data: any) { return addTo('workspaces', { ...data, orgId: ORG }); }
export async function deleteWorkspace(id: string) { return deleteAt(`workspaces/${id}`); }

// ===== TEMPLATES =====
export async function getTemplates() { return getByOrg('templates'); }
export async function createTemplate(data: any) { return addTo('templates', { ...data, orgId: ORG }); }
export async function deleteTemplate(id: string) { return deleteAt(`templates/${id}`); }
