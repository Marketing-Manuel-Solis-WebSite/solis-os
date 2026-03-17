import { describe, it, expect } from 'vitest';

// Pure logic copied to avoid Firebase import chain
interface SidebarPreferences {
  spaceOrder: string[];
  hiddenSpaces: string[];
  sectionsCollapsed: Record<string, boolean>;
}

function applySpaceOrder<T extends { id: string }>(
  spaces: T[],
  prefs: SidebarPreferences,
): T[] {
  const visible = spaces.filter(s => !prefs.hiddenSpaces.includes(s.id));
  if (prefs.spaceOrder.length === 0) return visible;
  const orderMap = new Map(prefs.spaceOrder.map((id, i) => [id, i]));
  const ordered: T[] = [];
  const unordered: T[] = [];
  for (const space of visible) {
    if (orderMap.has(space.id)) ordered.push(space);
    else unordered.push(space);
  }
  ordered.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  return [...ordered, ...unordered];
}

function reorderSpaces(
  currentOrder: string[],
  allSpaceIds: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const order = [...currentOrder];
  for (const id of allSpaceIds) {
    if (!order.includes(id)) order.push(id);
  }
  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);
  return order;
}

// ---- Test data ----
const mkSpace = (id: string) => ({ id, name: `Space ${id}` });
const DEFAULT_PREFS: SidebarPreferences = { spaceOrder: [], hiddenSpaces: [], sectionsCollapsed: {} };

// ---- Tests ----

describe('applySpaceOrder', () => {
  it('returns all spaces when no preferences set', () => {
    const spaces = [mkSpace('a'), mkSpace('b'), mkSpace('c')];
    const result = applySpaceOrder(spaces, DEFAULT_PREFS);
    expect(result.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('hides spaces in hiddenSpaces', () => {
    const spaces = [mkSpace('a'), mkSpace('b'), mkSpace('c')];
    const prefs: SidebarPreferences = { ...DEFAULT_PREFS, hiddenSpaces: ['b'] };
    const result = applySpaceOrder(spaces, prefs);
    expect(result.map(s => s.id)).toEqual(['a', 'c']);
  });

  it('hides multiple spaces', () => {
    const spaces = [mkSpace('a'), mkSpace('b'), mkSpace('c'), mkSpace('d')];
    const prefs: SidebarPreferences = { ...DEFAULT_PREFS, hiddenSpaces: ['a', 'c'] };
    const result = applySpaceOrder(spaces, prefs);
    expect(result.map(s => s.id)).toEqual(['b', 'd']);
  });

  it('reorders spaces by spaceOrder', () => {
    const spaces = [mkSpace('a'), mkSpace('b'), mkSpace('c')];
    const prefs: SidebarPreferences = { ...DEFAULT_PREFS, spaceOrder: ['c', 'a', 'b'] };
    const result = applySpaceOrder(spaces, prefs);
    expect(result.map(s => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('appends new spaces not in order at the end', () => {
    const spaces = [mkSpace('a'), mkSpace('b'), mkSpace('c'), mkSpace('d')];
    const prefs: SidebarPreferences = { ...DEFAULT_PREFS, spaceOrder: ['c', 'a'] };
    const result = applySpaceOrder(spaces, prefs);
    // c, a in order, then b, d in original order
    expect(result.map(s => s.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('handles both hide and reorder together', () => {
    const spaces = [mkSpace('a'), mkSpace('b'), mkSpace('c'), mkSpace('d')];
    const prefs: SidebarPreferences = { ...DEFAULT_PREFS, spaceOrder: ['d', 'b', 'a', 'c'], hiddenSpaces: ['a'] };
    const result = applySpaceOrder(spaces, prefs);
    expect(result.map(s => s.id)).toEqual(['d', 'b', 'c']);
  });

  it('handles empty spaces list', () => {
    const result = applySpaceOrder([], DEFAULT_PREFS);
    expect(result).toEqual([]);
  });

  it('handles hidden space that does not exist', () => {
    const spaces = [mkSpace('a'), mkSpace('b')];
    const prefs: SidebarPreferences = { ...DEFAULT_PREFS, hiddenSpaces: ['nonexistent'] };
    const result = applySpaceOrder(spaces, prefs);
    expect(result.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('handles order with stale IDs gracefully', () => {
    const spaces = [mkSpace('a'), mkSpace('b')];
    const prefs: SidebarPreferences = { ...DEFAULT_PREFS, spaceOrder: ['deleted', 'b', 'a'] };
    const result = applySpaceOrder(spaces, prefs);
    // b is at index 1 in order, a at index 2; 'deleted' is ignored
    expect(result.map(s => s.id)).toEqual(['b', 'a']);
  });
});

describe('reorderSpaces', () => {
  it('moves a space from index 0 to index 2', () => {
    const result = reorderSpaces(['a', 'b', 'c'], ['a', 'b', 'c'], 0, 2);
    expect(result).toEqual(['b', 'c', 'a']);
  });

  it('moves a space from index 2 to index 0', () => {
    const result = reorderSpaces(['a', 'b', 'c'], ['a', 'b', 'c'], 2, 0);
    expect(result).toEqual(['c', 'a', 'b']);
  });

  it('no-op when from equals to', () => {
    const result = reorderSpaces(['a', 'b', 'c'], ['a', 'b', 'c'], 1, 1);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('adds missing space IDs before reordering', () => {
    const result = reorderSpaces(['a', 'b'], ['a', 'b', 'c', 'd'], 0, 3);
    // Before reorder: ['a', 'b', 'c', 'd']
    // Move index 0 to index 3: ['b', 'c', 'd', 'a']
    expect(result).toEqual(['b', 'c', 'd', 'a']);
  });

  it('preserves existing order for IDs already present', () => {
    const result = reorderSpaces(['c', 'a', 'b'], ['a', 'b', 'c'], 0, 2);
    expect(result).toEqual(['a', 'b', 'c']);
  });
});
