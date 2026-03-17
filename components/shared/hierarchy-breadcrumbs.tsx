'use client';

import Link from 'next/link';
import { ChevronRight, Layers } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface HierarchyBreadcrumbsProps {
  spaceId: string;
  spaceName?: string;
  folderId?: string;
  folderName?: string;
  listId?: string;
  listName?: string;
}

interface Segment {
  label: string;
  href?: string; // undefined = current (not clickable)
}

export default function HierarchyBreadcrumbs({
  spaceId,
  spaceName,
  folderId,
  folderName,
  listId,
  listName,
}: HierarchyBreadcrumbsProps) {
  const { t } = useI18n();

  const segments: Segment[] = [
    { label: t('breadcrumbs.spaces'), href: '/app/spaces' },
    { label: spaceName || spaceId, href: `/app/spaces/${spaceId}` },
  ];

  if (folderId) {
    segments.push({
      label: folderName || folderId,
      href: listId ? `/app/spaces/${spaceId}/folder/${folderId}` : undefined,
    });
  }

  if (listId) {
    segments.push({
      label: listName || listId,
      // Last segment — not clickable
    });
  }

  // Mark the last segment as current (no href)
  const last = segments[segments.length - 1];
  if (last) last.href = undefined;

  return (
    <nav className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] overflow-x-auto shrink-0">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1 shrink-0">
          {i === 0 && <Layers className="h-3 w-3 shrink-0" />}
          {i > 0 && <ChevronRight className="h-3 w-3 text-[var(--text-muted)]/50 shrink-0" />}
          {seg.href ? (
            <Link
              href={seg.href}
              className="hover:text-[var(--accent)] transition truncate max-w-[180px]"
            >
              {seg.label}
            </Link>
          ) : (
            <span className="text-[var(--text-secondary)] font-medium truncate max-w-[180px]">
              {seg.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
