'use client';

import { useQuery } from '@tanstack/react-query';
import { getMembers } from '@/lib/db';

/** Members query with 5 min staleTime — members rarely change */
export function useMembersQuery() {
  return useQuery({
    queryKey: ['members'],
    queryFn: getMembers,
    staleTime: 5 * 60 * 1000,
  });
}
