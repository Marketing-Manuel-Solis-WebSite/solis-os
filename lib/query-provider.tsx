'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import dynamic from 'next/dynamic';

const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () =>
          import('@tanstack/react-query-devtools').then((m) => ({
            default: m.ReactQueryDevtools,
          })),
        { ssr: false },
      )
    : () => null;

/**
 * React Query provider with sensible defaults for a Firestore-backed app.
 *
 * - staleTime 60s: Firestore offline cache means data is usually fresh.
 * - retry 1: Firestore errors are rarely transient — one retry is enough.
 * - refetchOnWindowFocus: re-fetches when user tabs back in.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60 * 1000,  // clean up unmounted queries after 10 min
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
