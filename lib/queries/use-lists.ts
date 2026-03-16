'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLists,
  getListsByFolder,
  createList,
  updateList,
  deleteList,
  type ListData,
} from '@/lib/db';

/** All lists within a space */
export function useListsQuery(spaceId: string | null) {
  return useQuery({
    queryKey: ['lists', { spaceId }],
    queryFn: () => getLists(spaceId!),
    enabled: !!spaceId,
  });
}

/** Lists inside a specific folder */
export function useListsByFolderQuery(folderId: string | null) {
  return useQuery({
    queryKey: ['lists', 'byFolder', folderId],
    queryFn: () => getListsByFolder(folderId!),
    enabled: !!folderId,
  });
}

/** Create a list */
export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ListData, 'id' | 'orgId'>) => createList(data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['lists', { spaceId: variables.spaceId }] });
      if (variables.folderId) {
        qc.invalidateQueries({ queryKey: ['lists', 'byFolder', variables.folderId] });
      }
    },
  });
}

/** Update a list with optimistic updates */
export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ListData> }) =>
      updateList(id, data),

    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ['lists'] });

      // Snapshot all list query caches for rollback
      const previousQueries = qc.getQueriesData<ListData[]>({
        queryKey: ['lists'],
      });

      // Optimistically update every lists cache that contains this list
      qc.setQueriesData<ListData[]>(
        { queryKey: ['lists'] },
        (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((list) =>
            list.id === id ? { ...list, ...data } : list,
          );
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
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

/** Delete a list */
export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteList(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}
