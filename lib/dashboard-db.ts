import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DashboardConfig, WidgetLayout } from './dashboard-types';
import { DEFAULT_WIDGETS, ADMIN_DEFAULT_WIDGETS, SPACE_DEFAULT_WIDGETS } from './dashboard-types';
import { getCurrentOrgId, ORG_ID as ORG } from '@/lib/org';

// Multi-tenant ready: resolve org at call-time, not import-time
function dashboardsPath() { return `orgs/${getCurrentOrgId()}/dashboards`; }
/** @deprecated Use dashboardsPath() for multi-tenant readiness */
const DASHBOARDS_PATH = `orgs/${ORG}/dashboards`;

export async function getDashboards(userId: string): Promise<DashboardConfig[]> {
  const q = query(collection(db, DASHBOARDS_PATH), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardConfig));
}

export async function getDashboard(id: string): Promise<DashboardConfig | null> {
  const snap = await getDoc(doc(db, DASHBOARDS_PATH, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DashboardConfig;
}

export async function getDefaultDashboard(userId: string): Promise<DashboardConfig | null> {
  const dashboards = await getDashboards(userId);
  // Exclude space-scoped dashboards from the main default lookup
  const mainDashboards = dashboards.filter(d => !d.spaceId);
  const defaultOne = mainDashboards.find(d => d.isDefault);
  if (defaultOne) return defaultOne;
  if (mainDashboards.length > 0) return mainDashboards[0];
  return null;
}

export async function createDashboard(data: {
  userId: string;
  title: string;
  isDefault?: boolean;
  widgets?: WidgetLayout[];
}): Promise<string> {
  const ref = await addDoc(collection(db, DASHBOARDS_PATH), {
    userId: data.userId,
    title: data.title,
    isDefault: data.isDefault ?? true,
    widgets: data.widgets || DEFAULT_WIDGETS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveDashboard(id: string, data: Partial<DashboardConfig>): Promise<void> {
  const { id: _id, ...rest } = data as any;
  await updateDoc(doc(db, DASHBOARDS_PATH, id), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDashboard(id: string): Promise<void> {
  await deleteDoc(doc(db, DASHBOARDS_PATH, id));
}

// Ensure user has a default dashboard — creates one if none exists
// Uses role to determine which default widget set to use
export async function ensureDefaultDashboard(userId: string, isAdmin?: boolean): Promise<DashboardConfig> {
  const existing = await getDefaultDashboard(userId);
  if (existing) return existing;

  const widgets = isAdmin ? ADMIN_DEFAULT_WIDGETS : DEFAULT_WIDGETS;
  const id = await createDashboard({
    userId,
    title: 'Mi Dashboard',
    isDefault: true,
    widgets,
  });
  return {
    id,
    userId,
    title: 'Mi Dashboard',
    isDefault: true,
    widgets,
  };
}

// ===== Dashboard Sharing =====

export async function shareDashboard(id: string): Promise<string> {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
  await updateDoc(doc(db, DASHBOARDS_PATH, id), {
    isShared: true,
    publicToken: token,
    shareMode: 'view',
    updatedAt: serverTimestamp(),
  });
  return token;
}

export async function unshareDashboard(id: string): Promise<void> {
  await updateDoc(doc(db, DASHBOARDS_PATH, id), {
    isShared: false,
    publicToken: null,
    updatedAt: serverTimestamp(),
  });
}

export async function regenerateDashboardToken(id: string): Promise<string> {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
  await updateDoc(doc(db, DASHBOARDS_PATH, id), {
    publicToken: token,
    updatedAt: serverTimestamp(),
  });
  return token;
}

export async function getDashboardByToken(token: string): Promise<DashboardConfig | null> {
  const q = query(
    collection(db, DASHBOARDS_PATH),
    where('publicToken', '==', token),
    where('isShared', '==', true),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DashboardConfig;
}

// ===== Space-scoped dashboards =====

export async function getSpaceDashboard(userId: string, spaceId: string): Promise<DashboardConfig | null> {
  const dashboards = await getDashboards(userId);
  return dashboards.find(d => d.spaceId === spaceId) || null;
}

export async function ensureSpaceDashboard(userId: string, spaceId: string): Promise<DashboardConfig> {
  const existing = await getSpaceDashboard(userId, spaceId);
  if (existing) return existing;

  const widgets = SPACE_DEFAULT_WIDGETS;
  const ref = await addDoc(collection(db, DASHBOARDS_PATH), {
    userId,
    title: `Space Dashboard`,
    isDefault: false,
    spaceId,
    widgets,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    id: ref.id,
    userId,
    title: 'Space Dashboard',
    isDefault: false,
    spaceId,
    widgets,
  };
}
