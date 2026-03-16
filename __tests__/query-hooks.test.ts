// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Firebase before any imports
vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0 })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'test-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(() => new Date()),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  increment: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

// Mock db functions for mutation tests
const mockUpdateTask = vi.fn(() => Promise.resolve());
const mockDeleteTask = vi.fn(() => Promise.resolve());
const mockUpdateList = vi.fn(() => Promise.resolve());

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    updateTask: (...args: any[]) => mockUpdateTask(...args),
    deleteTask: (...args: any[]) => mockDeleteTask(...args),
    updateList: (...args: any[]) => mockUpdateList(...args),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe('Query hooks — exports', () => {
  it('use-tasks exports all hooks', async () => {
    const mod = await import('../lib/queries/use-tasks');
    expect(mod.useTasksQuery).toBeDefined();
    expect(mod.useTasksByListQuery).toBeDefined();
    expect(mod.useTaskCommentsQuery).toBeDefined();
    expect(mod.useTaskActivityQuery).toBeDefined();
    expect(mod.useCreateTask).toBeDefined();
    expect(mod.useUpdateTask).toBeDefined();
    expect(mod.useDeleteTask).toBeDefined();
    expect(mod.useTasksInfiniteQuery).toBeDefined();
  });

  it('use-lists exports all hooks', async () => {
    const mod = await import('../lib/queries/use-lists');
    expect(mod.useListsQuery).toBeDefined();
    expect(mod.useListsByFolderQuery).toBeDefined();
    expect(mod.useCreateList).toBeDefined();
    expect(mod.useUpdateList).toBeDefined();
    expect(mod.useDeleteList).toBeDefined();
  });

  it('use-spaces exports all hooks', async () => {
    const mod = await import('../lib/queries/use-spaces');
    expect(mod.useSpacesQuery).toBeDefined();
    expect(mod.useFoldersQuery).toBeDefined();
    expect(mod.useDocsBySpaceQuery).toBeDefined();
    expect(mod.useWhiteboardsBySpaceQuery).toBeDefined();
  });

  it('barrel index re-exports everything', async () => {
    const mod = await import('../lib/queries');
    expect(mod.useTasksQuery).toBeDefined();
    expect(mod.useCreateTask).toBeDefined();
    expect(mod.useTasksInfiniteQuery).toBeDefined();
    expect(mod.useListsQuery).toBeDefined();
    expect(mod.useCreateList).toBeDefined();
    expect(mod.useSpacesQuery).toBeDefined();
    expect(mod.useFoldersQuery).toBeDefined();
  });
});

describe('useUpdateTask — optimistic updates', () => {
  beforeEach(() => {
    mockUpdateTask.mockReset();
    mockUpdateTask.mockResolvedValue(undefined);
  });

  it('optimistically updates the task in cache', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { useUpdateTask } = await import('../lib/queries/use-tasks');

    // Seed the cache with task data
    const initialData = {
      items: [
        { id: 'task-1', title: 'Old Title', status: 'open' },
        { id: 'task-2', title: 'Another', status: 'open' },
      ],
      hasMore: false,
    };
    queryClient.setQueryData(['tasks', { teamId: '__all__' }], initialData);

    const { result } = renderHook(() => useUpdateTask(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'task-1', data: { title: 'New Title' } });
    });

    // Check the cache was optimistically updated
    const cached = queryClient.getQueryData<{ items: any[] }>(['tasks', { teamId: '__all__' }]);
    expect(cached!.items[0].title).toBe('New Title');
    expect(cached!.items[1].title).toBe('Another'); // unchanged
  });

  it('rolls back on mutation error', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { useUpdateTask } = await import('../lib/queries/use-tasks');

    mockUpdateTask.mockRejectedValueOnce(new Error('Server error'));

    const initialData = {
      items: [{ id: 'task-1', title: 'Original', status: 'open' }],
      hasMore: false,
    };
    queryClient.setQueryData(['tasks', { teamId: '__all__' }], initialData);

    const { result } = renderHook(() => useUpdateTask(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'task-1', data: { title: 'Should Fail' } });
    });

    // Wait for error state
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Cache should be rolled back to original
    const cached = queryClient.getQueryData<{ items: any[] }>(['tasks', { teamId: '__all__' }]);
    expect(cached!.items[0].title).toBe('Original');
  });
});

describe('useDeleteTask — optimistic updates', () => {
  beforeEach(() => {
    mockDeleteTask.mockReset();
    mockDeleteTask.mockResolvedValue(undefined);
  });

  it('optimistically removes the task from cache', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { useDeleteTask } = await import('../lib/queries/use-tasks');

    const initialData = {
      items: [
        { id: 'task-1', title: 'To Delete' },
        { id: 'task-2', title: 'Keep' },
      ],
      hasMore: false,
    };
    queryClient.setQueryData(['tasks', { teamId: '__all__' }], initialData);

    const { result } = renderHook(() => useDeleteTask(), { wrapper });

    await act(async () => {
      result.current.mutate('task-1');
    });

    // Check the task was optimistically removed
    const cached = queryClient.getQueryData<{ items: any[] }>(['tasks', { teamId: '__all__' }]);
    expect(cached!.items).toHaveLength(1);
    expect(cached!.items[0].id).toBe('task-2');
  });

  it('rolls back on mutation error', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { useDeleteTask } = await import('../lib/queries/use-tasks');

    mockDeleteTask.mockRejectedValueOnce(new Error('Delete failed'));

    const initialData = {
      items: [{ id: 'task-1', title: 'Should Survive' }],
      hasMore: false,
    };
    queryClient.setQueryData(['tasks', { teamId: '__all__' }], initialData);

    const { result } = renderHook(() => useDeleteTask(), { wrapper });

    await act(async () => {
      result.current.mutate('task-1');
    });

    // Wait for error state
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Cache should be rolled back
    const cached = queryClient.getQueryData<{ items: any[] }>(['tasks', { teamId: '__all__' }]);
    expect(cached!.items).toHaveLength(1);
    expect(cached!.items[0].title).toBe('Should Survive');
  });
});

describe('useUpdateList — optimistic updates', () => {
  beforeEach(() => {
    mockUpdateList.mockReset();
    mockUpdateList.mockResolvedValue(undefined);
  });

  it('optimistically updates the list in cache', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { useUpdateList } = await import('../lib/queries/use-lists');

    const initialData = [
      { id: 'list-1', name: 'Old Name', spaceId: 'sp-1', folderId: null, position: 0, createdBy: 'u1' },
      { id: 'list-2', name: 'Other', spaceId: 'sp-1', folderId: null, position: 1, createdBy: 'u1' },
    ];
    queryClient.setQueryData(['lists', { spaceId: 'sp-1' }], initialData);

    const { result } = renderHook(() => useUpdateList(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'list-1', data: { name: 'New Name' } });
    });

    const cached = queryClient.getQueryData<any[]>(['lists', { spaceId: 'sp-1' }]);
    expect(cached![0].name).toBe('New Name');
    expect(cached![1].name).toBe('Other'); // unchanged
  });

  it('rolls back on mutation error', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { useUpdateList } = await import('../lib/queries/use-lists');

    mockUpdateList.mockRejectedValueOnce(new Error('Update failed'));

    const initialData = [
      { id: 'list-1', name: 'Original', spaceId: 'sp-1', folderId: null, position: 0, createdBy: 'u1' },
    ];
    queryClient.setQueryData(['lists', { spaceId: 'sp-1' }], initialData);

    const { result } = renderHook(() => useUpdateList(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'list-1', data: { name: 'Should Fail' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<any[]>(['lists', { spaceId: 'sp-1' }]);
    expect(cached![0].name).toBe('Original');
  });
});
