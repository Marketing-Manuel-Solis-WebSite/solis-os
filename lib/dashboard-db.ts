import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DashboardConfig, WidgetLayout } from './dashboard-types';
import { DEFAULT_WIDGETS, ADMIN_DEFAULT_WIDGETS } from './dashboard-types';

const ORG = 'solis-center';
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
  const defaultOne = dashboards.find(d => d.isDefault);
  if (defaultOne) return defaultOne;
  if (dashboards.length > 0) return dashboards[0];
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
