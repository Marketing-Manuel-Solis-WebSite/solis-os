'use client';

import { useFeatureFlag } from '@/lib/feature-flags';

interface FeatureGateProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally render children based on a feature flag.
 *
 * Usage:
 *   <FeatureGate flag="view-gantt">
 *     <GanttView />
 *   </FeatureGate>
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
