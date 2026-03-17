'use client';

import { useState, useEffect } from 'react';
import { getSpaceFeatures, isSpaceFeatureEnabled, type SpaceFeatures } from '@/lib/space-features';

/**
 * Hook to load and check space features for a given space.
 *
 * Usage:
 *   const { features, isEnabled, loading } = useSpaceFeatures(spaceId);
 *   if (isEnabled('timeTracking')) { ... }
 */
export function useSpaceFeatures(spaceId: string | undefined) {
  const [features, setFeatures] = useState<SpaceFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spaceId) {
      setFeatures(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSpaceFeatures(spaceId)
      .then(f => { if (!cancelled) { setFeatures(f); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spaceId]);

  const isEnabled = (feature: keyof SpaceFeatures): boolean => {
    return isSpaceFeatureEnabled(features, feature);
  };

  return { features, isEnabled, loading };
}
