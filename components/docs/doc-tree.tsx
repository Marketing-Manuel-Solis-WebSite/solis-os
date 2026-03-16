'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileText, Plus } from 'lucide-react';

interface Doc {
  id: string;
  title: string;
  parentDocId?: string | null;
  [key: string]: any;
}

interface DocTreeProps {
  docs: Doc[];
  selectedDocId?: string;
  onSelectDoc: (docId: string) => void;
  onCreateSubpage: (parentDocId: string) => void;
}

interface DocTreeNodeProps {
  doc: Doc;
  childrenMap: Map<string, Doc[]>;
  depth: number;
  selectedDocId?: string;
  expandedIds: Set<string>;
  onToggle: (docId: string) => void;
  onSelectDoc: (docId: string) => void;
  onCreateSubpage: (parentDocId: string) => void;
}

function DocTreeNode({
  doc,
  childrenMap,
  depth,
  selectedDocId,
  expandedIds,
  onToggle,
  onSelectDoc,
  onCreateSubpage,
}: DocTreeNodeProps) {
  const children = childrenMap.get(doc.id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(doc.id);
  const isSelected = selectedDocId === doc.id;

  return (
    <div>
      {/* Node row */}
      <div
        className={`group flex items-center gap-1 py-1 px-2 rounded-lg cursor-pointer transition-all duration-150 text-sm ${
          isSelected
            ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelectDoc(doc.id)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(doc.id);
          }}
          className={`w-4 h-4 flex items-center justify-center shrink-0 rounded transition ${
            hasChildren
              ? 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              : 'invisible'
          }`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {/* Doc icon */}
        <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />

        {/* Title */}
        <span className="truncate flex-1 min-w-0">
          {doc.title || 'Untitled'}
        </span>

        {/* New subpage action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubpage(doc.id);
          }}
          className="w-5 h-5 flex items-center justify-center shrink-0 rounded opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition"
          title="New subpage"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Children (recursive) */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <DocTreeNode
              key={child.id}
              doc={child}
              childrenMap={childrenMap}
              depth={depth + 1}
              selectedDocId={selectedDocId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelectDoc={onSelectDoc}
              onCreateSubpage={onCreateSubpage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Recursive tree component that renders documents as expandable/collapsible nodes.
 * Root documents (parentDocId === null or undefined) appear at the top level;
 * children are nested under their parents.
 */
export default function DocTree({
  docs,
  selectedDocId,
  onSelectDoc,
  onCreateSubpage,
}: DocTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Build parent->children map
  const { rootDocs, childrenMap } = useMemo(() => {
    const map = new Map<string, Doc[]>();
    const roots: Doc[] = [];

    for (const d of docs) {
      const parentId = d.parentDocId;
      if (!parentId) {
        roots.push(d);
      } else {
        const siblings = map.get(parentId) || [];
        siblings.push(d);
        map.set(parentId, siblings);
      }
    }

    // Sort children by title within each group
    for (const [, children] of map) {
      children.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    roots.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    return { rootDocs: roots, childrenMap: map };
  }, [docs]);

  const handleToggle = useCallback((docId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  // Auto-expand path to selected doc
  useMemo(() => {
    if (!selectedDocId) return;
    const byId = new Map(docs.map((d) => [d.id, d]));
    const toExpand = new Set<string>();
    let current = byId.get(selectedDocId);
    while (current?.parentDocId) {
      toExpand.add(current.parentDocId);
      current = byId.get(current.parentDocId);
    }
    if (toExpand.size > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of toExpand) next.add(id);
        return next;
      });
    }
  }, [selectedDocId, docs]);

  if (docs.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-[13px] text-[var(--text-muted)]">
        No documents yet
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootDocs.map((doc) => (
        <DocTreeNode
          key={doc.id}
          doc={doc}
          childrenMap={childrenMap}
          depth={0}
          selectedDocId={selectedDocId}
          expandedIds={expandedIds}
          onToggle={handleToggle}
          onSelectDoc={onSelectDoc}
          onCreateSubpage={onCreateSubpage}
        />
      ))}
    </div>
  );
}
