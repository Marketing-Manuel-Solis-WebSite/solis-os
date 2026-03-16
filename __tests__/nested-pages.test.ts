import { describe, it, expect, vi } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'doc-new' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => true, id: 'test', data: () => ({}) }),
  getCountFromServer: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
  collectionGroup: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  runTransaction: vi.fn().mockResolvedValue(undefined),
  startAfter: vi.fn(),
  deleteField: vi.fn(),
  DocumentData: vi.fn(),
}));

import { createDocument, getDocuments } from '../lib/db';
import { addDoc, where, query } from 'firebase/firestore';
import { buildBreadcrumbPath, calcMaxDepth } from '../components/docs/doc-breadcrumbs';

// ===== Step 18 — parentDocId in data model =====

describe('Nested Pages — createDocument passes parentDocId', () => {
  it('stores parentDocId when provided', async () => {
    await createDocument({
      title: 'Child Doc',
      content: '',
      teamId: 'team-1',
      parentDocId: 'parent-1',
    });
    expect(addDoc).toHaveBeenCalled();
    const callArgs = (addDoc as any).mock.calls.at(-1);
    const data = callArgs[1];
    expect(data.parentDocId).toBe('parent-1');
  });

  it('defaults parentDocId to null when omitted', async () => {
    await createDocument({
      title: 'Top-Level Doc',
      content: '',
      teamId: 'team-1',
    });
    const callArgs = (addDoc as any).mock.calls.at(-1);
    const data = callArgs[1];
    expect(data.parentDocId).toBeNull();
  });

  it('stores parentDocId as null when explicitly set to null', async () => {
    await createDocument({
      title: 'Explicit Null',
      content: '',
      teamId: 'team-1',
      parentDocId: null,
    });
    const callArgs = (addDoc as any).mock.calls.at(-1);
    const data = callArgs[1];
    expect(data.parentDocId).toBeNull();
  });
});

describe('Nested Pages — getDocuments with parentDocId filter', () => {
  it('is a function', () => {
    expect(typeof getDocuments).toBe('function');
  });

  it('calls where with parentDocId when filtering by parent', async () => {
    await getDocuments('team-1', 500, 'parent-1');
    expect(where).toHaveBeenCalledWith('parentDocId', '==', 'parent-1');
  });

  it('calls where with null parentDocId for top-level docs', async () => {
    await getDocuments('team-1', 500, null);
    expect(where).toHaveBeenCalledWith('parentDocId', '==', null);
  });

  it('does not filter by parentDocId when parameter is undefined', async () => {
    (where as any).mockClear();
    await getDocuments('__all__', 500);
    const whereCalls = (where as any).mock.calls;
    const parentCalls = whereCalls.filter(
      (c: any[]) => c[0] === 'parentDocId'
    );
    expect(parentCalls.length).toBe(0);
  });
});

// ===== Step 21 — Breadcrumb helpers =====

describe('Nested Pages — calcMaxDepth', () => {
  const allDocs = [
    { id: 'root-1', parentDocId: null },
    { id: 'child-1', parentDocId: 'root-1' },
    { id: 'grandchild-1', parentDocId: 'child-1' },
    { id: 'root-2', parentDocId: null },
    { id: 'child-2', parentDocId: 'root-2' },
  ] as any[];

  it('returns 0 for a root document', () => {
    expect(calcMaxDepth('root-1', allDocs)).toBe(0);
  });

  it('returns 1 for a direct child', () => {
    expect(calcMaxDepth('child-1', allDocs)).toBe(1);
  });

  it('returns 2 for a grandchild', () => {
    expect(calcMaxDepth('grandchild-1', allDocs)).toBe(2);
  });

  it('returns 0 for an unknown document', () => {
    expect(calcMaxDepth('non-existent', allDocs)).toBe(0);
  });

  it('handles circular references gracefully (max 10 depth)', () => {
    const circular = [
      { id: 'a', parentDocId: 'b' },
      { id: 'b', parentDocId: 'a' },
    ] as any[];
    const depth = calcMaxDepth('a', circular);
    expect(depth).toBeLessThanOrEqual(10);
  });
});

describe('Nested Pages — buildBreadcrumbPath', () => {
  const allDocs = [
    { id: 'root', title: 'Root Doc', parentDocId: null },
    { id: 'child', title: 'Child Doc', parentDocId: 'root' },
    { id: 'grandchild', title: 'Grandchild Doc', parentDocId: 'child' },
  ] as any[];

  it('returns only the current doc for a root document', () => {
    const path = buildBreadcrumbPath('root', allDocs);
    expect(path).toEqual([{ id: 'root', title: 'Root Doc' }]);
  });

  it('returns [root, child] for a direct child', () => {
    const path = buildBreadcrumbPath('child', allDocs);
    expect(path).toEqual([
      { id: 'root', title: 'Root Doc' },
      { id: 'child', title: 'Child Doc' },
    ]);
  });

  it('returns full chain for a grandchild', () => {
    const path = buildBreadcrumbPath('grandchild', allDocs);
    expect(path).toEqual([
      { id: 'root', title: 'Root Doc' },
      { id: 'child', title: 'Child Doc' },
      { id: 'grandchild', title: 'Grandchild Doc' },
    ]);
  });

  it('returns empty array for non-existent doc', () => {
    const path = buildBreadcrumbPath('nonexistent', allDocs);
    expect(path).toEqual([]);
  });

  it('handles circular references without infinite loop', () => {
    const circular = [
      { id: 'a', title: 'A', parentDocId: 'b' },
      { id: 'b', title: 'B', parentDocId: 'a' },
    ] as any[];
    const path = buildBreadcrumbPath('a', circular);
    expect(path.length).toBeLessThanOrEqual(11);
  });
});
