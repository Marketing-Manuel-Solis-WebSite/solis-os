import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';



// ============================================
// TYPES
// ============================================

/**
 * Every status belongs to a category that controls core behavior.
 * This is what the system checks — not the status id.
 */
export type StatusCategory = 'not_started' | 'active' | 'done' | 'closed';

export interface StatusDef {
  id: string;
  name: string;
  nameEs: string;
  color: string;
  category: StatusCategory;
  order: number;
}

export interface StatusConfig {
  statuses: StatusDef[];
  version: number;
  updatedAt?: any;
  updatedBy?: string;
}

// ============================================
// DEFAULT STATUSES (backward compatible with existing data)
// ============================================

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: 'todo',        name: 'To Do',       nameEs: 'Por hacer',   color: '#64748B', category: 'not_started', order: 0 },
  { id: 'open',        name: 'Open',        nameEs: 'Abierto',     color: '#94A3B8', category: 'not_started', order: 1 },
  { id: 'in_progress', name: 'In Progress', nameEs: 'En progreso', color: '#3B82F6', category: 'active',      order: 2 },
  { id: 'in_review',   name: 'In Review',   nameEs: 'En revisión', color: '#A855F7', category: 'active',      order: 3 },
  { id: 'blocked',     name: 'Blocked',     nameEs: 'Bloqueado',   color: '#EF4444', category: 'active',      order: 4 },
  { id: 'done',        name: 'Done',        nameEs: 'Completado',  color: '#22C55E', category: 'done',        order: 5 },
];

// ============================================
// CATEGORY HELPERS — use these instead of hardcoded status checks
// ============================================

/** Returns true if the status represents a completed state */
export function isDoneStatus(statusId: string, statuses: StatusDef[] = DEFAULT_STATUSES): boolean {
  const s = statuses.find(x => x.id === statusId);
  // Backward compat: 'completed' was used in some legacy data
  return s?.category === 'done' || s?.category === 'closed' || statusId === 'completed';
}

/** Returns true if the status represents active work */
export function isActiveStatus(statusId: string, statuses: StatusDef[] = DEFAULT_STATUSES): boolean {
  const s = statuses.find(x => x.id === statusId);
  return s?.category === 'active';
}

/** Returns true if the status represents not yet started */
export function isNotStartedStatus(statusId: string, statuses: StatusDef[] = DEFAULT_STATUSES): boolean {
  const s = statuses.find(x => x.id === statusId);
  return s?.category === 'not_started';
}

/** Returns true if the task is blocked */
export function isBlockedStatus(statusId: string, statuses: StatusDef[] = DEFAULT_STATUSES): boolean {
  return statusId === 'blocked';
}

/** Get a status config by ID, with fallback */
export function getStatus(statusId: string, statuses: StatusDef[] = DEFAULT_STATUSES): StatusDef {
  return statuses.find(s => s.id === statusId) || statuses[0];
}

/** Get all valid status IDs for a given config */
export function getStatusIds(statuses: StatusDef[] = DEFAULT_STATUSES): string[] {
  return statuses.map(s => s.id);
}

/** Get the default "initial" status (first not_started status) */
export function getInitialStatus(statuses: StatusDef[] = DEFAULT_STATUSES): string {
  const first = statuses.find(s => s.category === 'not_started');
  return first?.id || statuses[0]?.id || 'todo';
}

/** Get the default "done" status (first done status) */
export function getDoneStatus(statuses: StatusDef[] = DEFAULT_STATUSES): string {
  const first = statuses.find(s => s.category === 'done');
  return first?.id || 'done';
}

// ============================================
// PERSISTENCE — load/save custom statuses per space
// ============================================

function statusConfigPath(spaceId: string): string {
  return `orgs/${ORG}/teams/${spaceId}/settings/statuses`;
}

/** Load status config for a space. Falls back to defaults. */
export async function loadSpaceStatuses(spaceId: string): Promise<StatusConfig> {
  try {
    const snap = await getDoc(doc(db, statusConfigPath(spaceId)));
    if (snap.exists()) {
      const data = snap.data();
      if (data.statuses?.length > 0) {
        return {
          statuses: data.statuses as StatusDef[],
          version: data.version || 1,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
      }
    }
  } catch (err) {
    console.error('[StatusConfig] Failed to load space statuses:', err);
  }
  return { statuses: DEFAULT_STATUSES, version: 0 };
}

/** Save custom statuses for a space */
export async function saveSpaceStatuses(
  spaceId: string,
  statuses: StatusDef[],
  userId: string,
  currentVersion: number,
): Promise<void> {
  // Validate: must have at least one not_started and one done status
  const hasStart = statuses.some(s => s.category === 'not_started');
  const hasDone = statuses.some(s => s.category === 'done');
  if (!hasStart || !hasDone) {
    throw new Error('Status config must have at least one "not_started" and one "done" status.');
  }

  await setDoc(doc(db, statusConfigPath(spaceId)), {
    statuses,
    version: currentVersion + 1,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/** Generate a unique status ID from a name */
export function generateStatusId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30);
}
