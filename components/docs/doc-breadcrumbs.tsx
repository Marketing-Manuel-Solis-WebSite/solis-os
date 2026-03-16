'use client';

import { ChevronRight, FileText } from 'lucide-react';

interface BreadcrumbDoc {
  id: string;
  title: string;
  parentDocId?: string | null;
}

interface BreadcrumbEntry {
  id: string;
  title: string;
}

interface DocBreadcrumbsProps {
  currentDoc: BreadcrumbDoc;
  allDocs: BreadcrumbDoc[];
  onNavigate: (docId: string) => void;
}

const MAX_DEPTH = 10;

/**
 * Walk up the parentDocId chain to build a breadcrumb path from root to the given doc.
 * Exported for testing.
 */
export function buildBreadcrumbPath(docId: string, allDocs: BreadcrumbDoc[]): BreadcrumbEntry[] {
  const byId = new Map(allDocs.map(d => [d.id, d]));
  const doc = byId.get(docId);
  if (!doc) return [];

  const path: BreadcrumbEntry[] = [];
  let current: BreadcrumbDoc | undefined = doc;
  const visited = new Set<string>();

  while (current && path.length <= MAX_DEPTH) {
    if (visited.has(current.id)) break; // circular reference guard
    visited.add(current.id);
    path.unshift({ id: current.id, title: current.title });
    if (!current.parentDocId) break;
    current = byId.get(current.parentDocId);
  }

  return path;
}

/**
 * Calculate the depth of a document in the nesting hierarchy.
 * Returns 0 for root (or unknown) docs, 1 for direct children, etc.
 * Exported for testing.
 */
export function calcMaxDepth(docId: string, allDocs: BreadcrumbDoc[]): number {
  const byId = new Map(allDocs.map(d => [d.id, d]));
  const doc = byId.get(docId);
  if (!doc) return 0;

  let depth = 0;
  let current: BreadcrumbDoc | undefined = doc;
  const visited = new Set<string>();

  while (current?.parentDocId && depth < MAX_DEPTH) {
    if (visited.has(current.id)) break; // circular reference guard
    visited.add(current.id);
    current = byId.get(current.parentDocId);
    if (current) depth++;
  }

  return depth;
}

/**
 * Breadcrumbs component for nested pages.
 * Renders "Documents > Parent Doc > Current Doc" with clickable ancestors.
 */
export default function DocBreadcrumbs({ currentDoc, allDocs, onNavigate }: DocBreadcrumbsProps) {
  const path = buildBreadcrumbPath(currentDoc.id, allDocs);

  // Don't render breadcrumbs for root-level docs (no parent)
  if (path.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 px-4 py-1.5 text-[13px] text-[var(--text-muted)] overflow-x-auto shrink-0">
      <button
        onClick={() => onNavigate('__root__')}
        className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition shrink-0"
      >
        <FileText className="h-3 w-3" />
        <span>Documents</span>
      </button>

      {path.map((entry, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={entry.id} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="h-3 w-3 text-[var(--text-muted)]/50" />
            {isLast ? (
              <span className="text-[var(--text-primary)] font-medium truncate max-w-[200px]">
                {entry.title || 'Untitled'}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(entry.id)}
                className="hover:text-[var(--text-secondary)] transition truncate max-w-[200px]"
              >
                {entry.title || 'Untitled'}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
