'use client';

import { useQuery } from '@tanstack/react-query';
import { getTeams } from '@/lib/db';

/** Teams query with 10 min staleTime — teams rarely change */
export function useTeamsQuery() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
    staleTime: 10 * 60 * 1000,
  });
}
