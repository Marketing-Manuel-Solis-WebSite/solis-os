'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { toggleFavorite, isFavorite } from '@/lib/favorites';

interface FavoriteButtonProps {
  entityType: 'task' | 'goal' | 'doc' | 'space' | 'list';
  entityId: string;
  entityTitle?: string;
  userId: string;
  size?: number;
  className?: string;
}

export default function FavoriteButton({
  entityType,
  entityId,
  entityTitle,
  userId,
  size = 16,
  className = '',
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !entityId) return;
    let cancelled = false;
    isFavorite(userId, entityType, entityId).then((val) => {
      if (!cancelled) setFavorited(val);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, entityType, entityId]);

  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (loading || !userId) return;
    // Optimistic update
    setFavorited((prev) => !prev);
    setLoading(true);
    try {
      const added = await toggleFavorite(userId, { entityType, entityId, entityTitle });
      setFavorited(added);
    } catch {
      // Revert on error
      setFavorited((prev) => !prev);
    } finally {
      setLoading(false);
    }
  }, [loading, userId, entityType, entityId, entityTitle]);

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`p-1 rounded-md transition-all duration-200 ${
        favorited
          ? 'text-amber-400 hover:text-amber-500'
          : 'text-[var(--text-muted)] hover:text-amber-400'
      } hover:bg-[var(--bg-hover)] disabled:opacity-50 ${className}`}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className="transition-all duration-200"
        style={{ width: size, height: size }}
        strokeWidth={1.75}
        fill={favorited ? 'currentColor' : 'none'}
      />
    </button>
  );
}
