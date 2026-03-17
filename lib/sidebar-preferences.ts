'use client';

// ================================================================
// Sidebar Preferences — Per-user space order, visibility, collapse
// ================================================================
// Stored at: orgs/{orgId}/members/{userId}/preferences/sidebar

import { getUserPreferences, saveUserPreferences } from './db';

export interface SidebarPreferences {
  /** Ordered space IDs — spaces appear in this order */
  spaceOrder: string[];
  /** Hidden space IDs — hidden from sidebar but still accessible */
  hiddenSpaces: string[];
  /** Collapsed section states */
  sectionsCollapsed: Record<string, boolean>;
}

export const DEFAULT_SIDEBAR_PREFS: SidebarPreferences = {
  spaceOrder: [],
  hiddenSpaces: [],
  sectionsCollapsed: {},
};

const PREFS_KEY = 'sidebar';

export async function getSidebarPreferences(userId: string): Promise<SidebarPreferences> {
  try {
    const data = await getUserPreferences(userId, PREFS_KEY);
    if (data) {
      return { ...DEFAULT_SIDEBAR_PREFS, ...data } as SidebarPreferences;
    }
  } catch {
    // silent
  }
  return { ...DEFAULT_SIDEBAR_PREFS };
}

export async function saveSidebarPreferences(
  userId: string,
  prefs: Partial<SidebarPreferences>,
): Promise<void> {
  await saveUserPreferences(userId, PREFS_KEY, prefs);
}

/**
 * Apply user preferences to a list of spaces:
 * 1. Filter out hidden spaces
 * 2. Sort by user's preferred order
 * 3. Append any new spaces not in the order list at the end
 */
export function applySpaceOrder<T extends { id: string }>(
  spaces: T[],
  prefs: SidebarPreferences,
): T[] {
  // Filter hidden
  const visible = spaces.filter(s => !prefs.hiddenSpaces.includes(s.id));

  if (prefs.spaceOrder.length === 0) return visible;

  // Sort by user order
  const orderMap = new Map(prefs.spaceOrder.map((id, i) => [id, i]));
  const ordered: T[] = [];
  const unordered: T[] = [];

  for (const space of visible) {
    if (orderMap.has(space.id)) {
      ordered.push(space);
    } else {
      unordered.push(space);
    }
  }

  ordered.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  return [...ordered, ...unordered];
}

/**
 * Move a space from one position to another in the order.
 */
export function reorderSpaces(
  currentOrder: string[],
  allSpaceIds: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  // Ensure all spaces are in the order
  const order = [...currentOrder];
  for (const id of allSpaceIds) {
    if (!order.includes(id)) order.push(id);
  }

  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);
  return order;
}
