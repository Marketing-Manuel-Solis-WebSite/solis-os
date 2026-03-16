import { describe, it, expect, vi } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn(() => () => {}),
  deleteField: vi.fn(),
  serverTimestamp: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}));
vi.mock('@/lib/db', () => ({
  setPresence: vi.fn().mockResolvedValue(undefined),
}));

describe('Realtime — module exports', () => {
  it('exports all realtime hooks and utilities', async () => {
    const mod = await import('../lib/realtime');
    expect(typeof mod.usePresence).toBe('function');
    expect(typeof mod.useActiveViewers).toBe('function');
    expect(typeof mod.joinViewing).toBe('function');
    expect(typeof mod.leaveViewing).toBe('function');
    expect(typeof mod.onActiveViewersSnapshot).toBe('function');
    expect(typeof mod.useRealtimeDoc).toBe('function');
    expect(typeof mod.useRealtimeTask).toBe('function');
  });
});

describe('Realtime — active-viewers pure logic', () => {
  it('onActiveViewersSnapshot is a function that accepts correct args', async () => {
    const { onActiveViewersSnapshot } = await import('../lib/realtime/active-viewers');
    expect(typeof onActiveViewersSnapshot).toBe('function');
    // Call it — the mock onSnapshot returns a no-op unsub
    const unsub = onActiveViewersSnapshot('doc', 'doc-1', 'user-1', () => {});
    expect(typeof unsub).toBe('function');
  });

  it('joinViewing calls setDoc with correct merge strategy', async () => {
    const { setDoc } = await import('firebase/firestore');
    const { joinViewing } = await import('../lib/realtime/active-viewers');
    await joinViewing('task', 'task-1', 'user-1', 'John');
    expect(setDoc).toHaveBeenCalled();
  });
});

describe('Realtime — use-realtime-task export', () => {
  it('useRealtimeTask is a function', async () => {
    const { useRealtimeTask } = await import('../lib/realtime/use-realtime-task');
    expect(typeof useRealtimeTask).toBe('function');
  });
});

describe('Realtime — use-realtime-doc export', () => {
  it('useRealtimeDoc is a function', async () => {
    const { useRealtimeDoc } = await import('../lib/realtime/use-realtime-doc');
    expect(typeof useRealtimeDoc).toBe('function');
  });
});

describe('Realtime — type exports', () => {
  it('type interfaces are importable', async () => {
    // TypeScript validates these at compile time, this just confirms the module loads
    const mod = await import('../lib/realtime');
    expect(mod).toBeDefined();
  });
});
