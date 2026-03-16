'use client';

// ============================================================
// Task Table View — spreadsheet-like view with all columns,
// inline editing, horizontal scroll, and frozen title column.
// Uses @tanstack/react-virtual for efficient rendering of large lists.
// ============================================================

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useI18n } from '@/lib/i18n';
import {
  ChevronDown, ChevronUp, Check, X,
  Calendar, Trash2, Plus,
} from 'lucide-react';
import {
  STATUSES, PRIORITIES, TASK_TYPES, ALL_COLUMNS,
  Task, TaskGroup, Density, SubtaskDisplay,
  getStatusConfig, getPriorityConfig, getTypeConfig, isOverdue,
} from './constants';
import TaskQuickAdd from './task-quick-add';

// ─── Props ───────────────────────────────────────────────
interface Props {
  groups: TaskGroup[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  canUpdate: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSelect: (task: Task) => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: Task) => void;
  onSortChange: (field: string) => void;
  onQuickCreate: (data: any) => void;
}

// ─── All table columns (show everything) ─────────────────
const TABLE_COLUMNS = ALL_COLUMNS.filter(c => c.id !== 'checkbox');

// ─── Date formatter ──────────────────────────────────────
function formatDate(d: Date, locale = 'es-MX'): string {
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Flattened row type for virtualizer ──────────────────
type FlatRow =
  | { type: 'group-header'; key: string; label: string; count: number }
  | { type: 'task'; task: Task; groupKey: string }
  | { type: 'quick-add'; groupKey: string; groupLabel: string };

// ─── Main Component ──────────────────────────────────────
export default function TaskTableView({
  groups, members, teams, selectedTask, canUpdate,
  sortBy, sortDir, onSelect, onUpdate, onDelete, onSortChange, onQuickCreate,
}: Props) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editCell, setEditCell] = useState<{ taskId: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Start inline edit
  const startEdit = useCallback((taskId: string, col: string, currentValue: string) => {
    if (!canUpdate) return;
    setEditCell({ taskId, col });
    setEditValue(currentValue);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [canUpdate]);

  // Save inline edit
  const saveEdit = useCallback(() => {
    if (!editCell) return;
    const { taskId, col } = editCell;
    let field = col;
    let value: any = editValue;

    if (col === 'points') {
      value = parseInt(editValue) || 0;
    } else if (col === 'timeEstimate') {
      value = parseInt(editValue) || 0;
    } else if (col === 'due') {
      field = 'dueDate';
      value = editValue || null;
    } else if (col === 'title') {
      if (!editValue.trim()) { setEditCell(null); return; }
      value = editValue.trim();
    }

    onUpdate(taskId, field, value);
    setEditCell(null);
  }, [editCell, editValue, onUpdate]);

  const cancelEdit = useCallback(() => setEditCell(null), []);

  // Flatten groups into a single row array for the virtualizer
  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const group of groups) {
      const isCollapsed = collapsed.has(group.key);
      if (groups.length > 1) {
        rows.push({ type: 'group-header', key: group.key, label: group.label, count: group.tasks.length });
      }
      if (!isCollapsed) {
        for (const task of group.tasks) {
          rows.push({ type: 'task', task, groupKey: group.key });
        }
        if (canUpdate) {
          rows.push({ type: 'quick-add', groupKey: group.key, groupLabel: group.label });
        }
      }
    }
    return rows;
  }, [groups, collapsed, canUpdate]);

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  // Render cell content
  const renderCell = (task: Task, col: string) => {
    const isEditing = editCell?.taskId === task.id && editCell?.col === col;

    switch (col) {
      case 'status': {
        const cfg = getStatusConfig(task.status);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!canUpdate) return;
              const idx = STATUSES.findIndex(s => s.id === task.status);
              const next = STATUSES[(idx + 1) % STATUSES.length];
              onUpdate(task.id, 'status', next.id, task.status);
            }}
            className="flex items-center gap-1.5"
          >
            {cfg && <cfg.Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />}
          </button>
        );
      }

      case 'title': {
        if (isEditing) {
          return (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              onBlur={saveEdit}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none border-b border-[var(--accent)]"
            />
          );
        }
        return (
          <span
            className="text-sm text-[var(--text-primary)] truncate cursor-pointer hover:text-[var(--accent)]"
            onDoubleClick={() => startEdit(task.id, 'title', task.title)}
          >
            {task.title}
          </span>
        );
      }

      case 'priority': {
        const cfg = getPriorityConfig(task.priority);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!canUpdate) return;
              const idx = PRIORITIES.findIndex(p => p.id === task.priority);
              const next = PRIORITIES[(idx + 1) % PRIORITIES.length];
              onUpdate(task.id, 'priority', next.id, task.priority);
            }}
            className="text-[12px] font-medium px-1.5 py-0.5 rounded"
            style={{ color: cfg?.color }}
          >
            {cfg?.icon} {t(`priorities.${task.priority}`) || task.priority}
          </button>
        );
      }

      case 'assignees': {
        const names = task.assignees
          .map(uid => members.find(m => m.userId === uid)?.displayName || '')
          .filter(Boolean);
        return (
          <span className="text-[12px] text-[var(--text-secondary)] truncate">
            {names.length ? names.join(', ') : '\u2014'}
          </span>
        );
      }

      case 'due': {
        const d = toDate(task.dueDate);
        if (isEditing) {
          return (
            <input
              ref={inputRef}
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              onBlur={saveEdit}
              className="w-full bg-transparent text-[12px] text-[var(--text-primary)] outline-none"
            />
          );
        }
        const overdue = d && isOverdue(task);
        return (
          <span
            className={`text-[12px] cursor-pointer ${overdue ? 'text-red-400' : 'text-[var(--text-muted)]'}`}
            onDoubleClick={() => startEdit(task.id, 'due', d ? d.toISOString().slice(0, 10) : '')}
          >
            {d ? formatDate(d) : '\u2014'}
          </span>
        );
      }

      case 'tags': {
        return (
          <div className="flex gap-1 overflow-hidden">
            {(task.tags || []).slice(0, 2).map(tag => (
              <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-muted)] truncate max-w-[60px]">
                {tag}
              </span>
            ))}
            {task.tags?.length > 2 && (
              <span className="text-[11px] text-[var(--text-muted)]">+{task.tags.length - 2}</span>
            )}
          </div>
        );
      }

      case 'points': {
        if (isEditing) {
          return (
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              onBlur={saveEdit}
              className="w-full bg-transparent text-[12px] text-[var(--text-primary)] outline-none border-b border-[var(--accent)]"
            />
          );
        }
        return (
          <span
            className="text-[12px] text-[var(--text-muted)] cursor-pointer"
            onDoubleClick={() => startEdit(task.id, 'points', String(task.points || 0))}
          >
            {task.points ?? '\u2014'}
          </span>
        );
      }

      case 'type': {
        const cfg = getTypeConfig(task.type);
        return (
          <span className="text-[12px] text-[var(--text-muted)]">
            {cfg && <cfg.Icon className="h-3 w-3 inline mr-1" style={{ color: cfg.color }} />}
            {t(`taskTypes.${task.type}`) || task.type}
          </span>
        );
      }

      case 'timeEstimate': {
        if (isEditing) {
          return (
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              onBlur={saveEdit}
              className="w-full bg-transparent text-[12px] text-[var(--text-primary)] outline-none border-b border-[var(--accent)]"
            />
          );
        }
        const mins = task.timeEstimate || 0;
        return (
          <span
            className="text-[12px] text-[var(--text-muted)] cursor-pointer"
            onDoubleClick={() => startEdit(task.id, 'timeEstimate', String(mins))}
          >
            {mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '\u2014'}
          </span>
        );
      }

      case 'created': {
        const d = toDate(task.createdAt);
        return <span className="text-[12px] text-[var(--text-muted)]">{d ? formatDate(d) : '\u2014'}</span>;
      }

      case 'team': {
        const team = teams.find(t => t.id === task.teamId);
        return <span className="text-[12px] text-[var(--text-muted)] truncate">{team?.name || '\u2014'}</span>;
      }

      default:
        return <span className="text-[12px] text-[var(--text-muted)]">{'\u2014'}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table container with horizontal scroll */}
      <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
        <table className="w-full min-w-[900px] border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-[var(--bg-base)]">
            <tr className="border-b border-[var(--border-subtle)]">
              {TABLE_COLUMNS.map(col => (
                <th
                  key={col.id}
                  className={`px-3 py-2 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider
                    ${col.id === 'title' ? 'sticky left-0 bg-[var(--bg-base)] z-20 min-w-[250px]' : ''}
                    ${col.id === 'status' ? 'w-10' : ''}
                    ${col.sortable ? 'cursor-pointer hover:text-[var(--text-secondary)]' : ''}`}
                  onClick={() => col.sortable && onSortChange(col.id === 'due' ? 'dueDate' : col.id)}
                >
                  <div className="flex items-center gap-1">
                    {col.labelKey ? t(col.labelKey) || col.id : ''}
                    {col.sortable && sortBy === (col.id === 'due' ? 'dueDate' : col.id) && (
                      sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
              ))}
              {/* Actions column */}
              <th className="w-10 px-2" />
            </tr>
          </thead>

          {/* Virtualized Body */}
          <tbody>
            {/* Spacer for virtual offset */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }}>
                <td colSpan={TABLE_COLUMNS.length + 1} />
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = flatRows[virtualRow.index];

              if (row.type === 'group-header') {
                const isCollapsed = collapsed.has(row.key);
                return (
                  <tr
                    key={`gh-${row.key}`}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="bg-[var(--bg-tertiary)] cursor-pointer hover:bg-[var(--bg-hover)]"
                    onClick={() => toggleGroup(row.key)}
                  >
                    <td colSpan={TABLE_COLUMNS.length + 1} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] rotate-180" />}
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{row.label}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">({row.count})</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              if (row.type === 'quick-add') {
                return (
                  <tr
                    key={`qa-${row.groupKey}`}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                  >
                    <td colSpan={TABLE_COLUMNS.length + 1} className="px-3 py-1">
                      <TaskQuickAdd
                        groupKey={row.groupKey}
                        groupLabel={row.groupLabel}
                        onAdd={(title) => onQuickCreate({ title, status: row.groupKey })}
                      />
                    </td>
                  </tr>
                );
              }

              // Task row
              const task = row.task;
              return (
                <tr
                  key={task.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={`border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer
                    ${selectedTask?.id === task.id ? 'bg-[var(--accent-subtle)]' : ''}`}
                  onClick={() => onSelect(task)}
                >
                  {TABLE_COLUMNS.map(col => (
                    <td
                      key={col.id}
                      className={`px-3 py-2
                        ${col.id === 'title' ? 'sticky left-0 bg-inherit z-10 min-w-[250px]' : ''}
                        ${col.id === 'status' ? 'w-10' : ''}`}
                    >
                      {renderCell(task, col.id)}
                    </td>
                  ))}
                  {/* Delete action */}
                  <td className="w-10 px-2">
                    {canUpdate && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(task); }}
                        className="p-1 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Bottom spacer for virtual scroll */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{
                height: rowVirtualizer.getTotalSize() -
                  (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0),
              }}>
                <td colSpan={TABLE_COLUMNS.length + 1} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
