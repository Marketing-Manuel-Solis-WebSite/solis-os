'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  getTasks,
  getTasksByList,
  getTasksPaginated,
  createTask,
  updateTask,
  deleteTask,
  getTaskComments,
  getTaskActivity,
} from '@/lib/db';

/** All tasks for a team (or all if no teamId) */
export function useTasksQuery(teamId?: string) {
  return useQuery({
    queryKey: ['tasks', { teamId: teamId ?? '__all__' }],
    queryFn: () => getTasks(teamId),
  });
}

/** Tasks filtered by list */
export function useTasksByListQuery(listId: string | null) {
  return useQuery({
    queryKey: ['tasks', 'byList', listId],
    queryFn: () => getTasksByList(listId!),
    enabled: !!listId,
  });
}

/** Comments for a single task */
export function useTaskCommentsQuery(taskId: string | null) {
  return useQuery({
    queryKey: ['tasks', taskId, 'comments'],
    queryFn: () => getTaskComments(taskId!),
    enabled: !!taskId,
  });
}

/** Activity log for a single task */
export function useTaskActivityQuery(taskId: string | null) {
  return useQuery({
    queryKey: ['tasks', taskId, 'activity'],
    queryFn: () => getTaskActivity(taskId!),
    enabled: !!taskId,
  });
}

/** Create a task and invalidate relevant caches */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createTask>[0]) => createTask(data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (variables.listId) {
        qc.invalidateQueries({ queryKey: ['tasks', 'byList', variables.listId] });
      }
    },
  });
}

/** Update a task with optimistic updates */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTask>[1] }) =>
      updateTask(id, data),

    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ['tasks'] });

      // Snapshot all task query caches for rollback
      const previousQueries = qc.getQueriesData<{ items: any[]; hasMore: boolean }>({
        queryKey: ['tasks'],
      });

      // Optimistically update every tasks cache that contains this task
      qc.setQueriesData<{ items: any[]; hasMore: boolean }>(
        { queryKey: ['tasks'] },
        (old) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.map((task: any) =>
              task.id === id ? { ...task, ...data } : task,
            ),
          };
        },
      );

      return { previousQueries };
    },

    onError: (_err, _variables, context) => {
      // Rollback to the previous state on error
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          qc.setQueryData(queryKey, data);
        }
      }
    },

    onSettled: () => {
      // Always refetch after error or success to ensure server state
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/** Delete (soft-delete) a task with optimistic removal */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),

    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await qc.cancelQueries({ queryKey: ['tasks'] });

      // Snapshot all task query caches for rollback
      const previousQueries = qc.getQueriesData<{ items: any[]; hasMore: boolean }>({
        queryKey: ['tasks'],
      });

      // Optimistically remove the task from every cache
      qc.setQueriesData<{ items: any[]; hasMore: boolean }>(
        { queryKey: ['tasks'] },
        (old) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.filter((task: any) => task.id !== id),
          };
        },
      );

      return { previousQueries };
    },

    onError: (_err, _id, context) => {
      // Rollback to the previous state on error
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          qc.setQueryData(queryKey, data);
        }
      }
    },

    onSettled: () => {
      // Always refetch after error or success
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/** Infinite-scroll paginated tasks query */
export function useTasksInfiniteQuery({
  teamId,
  pageSize = 50,
  status,
  sortBy = 'createdAt',
}: {
  teamId?: string;
  pageSize?: number;
  status?: string;
  sortBy?: string;
} = {}) {
  return useInfiniteQuery({
    queryKey: ['tasks', 'infinite', { teamId: teamId ?? '__all__', status, sortBy, pageSize }],
    queryFn: ({ pageParam }) =>
      getTasksPaginated({
        teamId,
        pageSize,
        lastDoc: pageParam ?? null,
        status,
        sortBy,
      }),
    initialPageParam: null as any,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
  });
}
