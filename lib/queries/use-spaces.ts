'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeams,
  getFolders,
  getDocsBySpace,
  getWhiteboardsBySpace,
} from '@/lib/db';

/** All spaces (teams) in the org */
export function useSpacesQuery() {
  return useQuery({
    queryKey: ['spaces'],
    queryFn: getTeams,
  });
}

/** Folders within a space */
export function useFoldersQuery(spaceId: string | null) {
  return useQuery({
    queryKey: ['folders', { spaceId }],
    queryFn: () => getFolders(spaceId!),
    enabled: !!spaceId,
  });
}

/** Documents within a space */
export function useDocsBySpaceQuery(spaceId: string | null) {
  return useQuery({
    queryKey: ['docs', { spaceId }],
    queryFn: () => getDocsBySpace(spaceId!),
    enabled: !!spaceId,
  });
}

/** Whiteboards within a space */
export function useWhiteboardsBySpaceQuery(spaceId: string | null) {
  return useQuery({
    queryKey: ['whiteboards', { spaceId }],
    queryFn: () => getWhiteboardsBySpace(spaceId!),
    enabled: !!spaceId,
  });
}
