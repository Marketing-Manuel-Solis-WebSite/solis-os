'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, ChevronRight, Calendar, User,
  Check, Loader2, Circle, Eye, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { createSubtask, deleteSubtask, rollupProgress } from '@/lib/subtask-ops';
import { updateTask } from '@/lib/db';
import { STATUSES, PRIORITIES, getStatusConfig, getPriorityConfig } from './constants';

// ============================================================
// Types
// ============================================================

interface SubtaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignees: string[];
  dueDate?: any;
  parentTaskId?: string;
  subtaskIds?: string[];
  subtaskDepth?: number;
  deleted?: boolean;
  [key: string]: any;
}

interface Props {
  parentTaskId: string;
  subtasks: SubtaskItem[];
  members: any[];
  teamId: string;
  listId?: string | null;
  userId: string;
  canUpdate: boolean;
  /** Called after any mutation so parent can refetch. */
  onMutate: () => void;
  /** Max nesting depth to render (1 = flat, 2 = one level of children, etc.) */
  maxDepth?: number;
  /** Current nesting depth (internal, starts at 0). */
  depth?: number;
  /** Map of taskId -> SubtaskItem[] for nested subtasks (pre-fetched by parent). */
  childrenMap?: Record<string, SubtaskItem[]>;
}

// ============================================================
// Status Icon Helper
// ============================================================

const STATUS_ICONS: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Loader2,
  in_review: Eye,
  done: CheckCircle2,
  blocked: AlertCircle,
};

function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const cfg = getStatusConfig(status);
  const Icon = STATUS_ICONS[status] || Circle;
  return <Icon className={status === 'in_progress' ? 'animate-spin' : ''} style={{ color: cfg.color, width: size, height: size }} />;
}

// ============================================================
// Subtask Card (single row)
// ============================================================

function SubtaskCard({
  task,
  members,
  canUpdate,
  parentTaskId,
  onMutate,
  onToggleExpand,
  isExpanded,
  hasChildren,
  onStatusChange,
}: {
  task: SubtaskItem;
  members: any[];
  canUpdate: boolean;
  parentTaskId: string;
  onMutate: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
  hasChildren: boolean;
  onStatusChange: (taskId: string, newStatus: string) => void;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const st = getStatusConfig(task.status);
  const pr = getPriorityConfig(task.priority);
  const isDone = task.status === 'done';
  const due = task.dueDate?.toDate?.();
  const assignee = task.assignees?.length ? members.find((m: any) => m.id === task.assignees[0]) : null;

  const handleDelete = async () => {
    if (!canUpdate || deleting) return;
    setDeleting(true);
    try {
      await deleteSubtask(task.id, parentTaskId);
      onMutate();
    } catch (err) {
      console.error('[SubtaskList] delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusToggle = () => {
    if (!canUpdate) return;
    const newStatus = isDone ? 'todo' : 'done';
    onStatusChange(task.id, newStatus);
  };

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-[var(--bg-elevated)] group transition-colors duration-150">
      {/* Expand toggle (only if has children) */}
      <button
        onClick={onToggleExpand}
        className={`w-4 h-4 flex items-center justify-center transition-transform duration-200 ${
          hasChildren ? 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]' : 'invisible'
        } ${isExpanded ? 'rotate-90' : ''}`}
      >
        <ChevronRight className="h-3 w-3" />
      </button>

      {/* Status checkbox */}
      <button
        onClick={handleStatusToggle}
        disabled={!canUpdate}
        className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition shrink-0 ${
          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--border)]'
        }`}
      >
        {isDone && <Check className="h-2.5 w-2.5" />}
      </button>

      {/* Title */}
      <span className={`text-[13px] flex-1 truncate ${
        isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'
      }`}>
        {task.title}
      </span>

      {/* Priority badge */}
      <span
        className="text-[11px] px-1.5 py-0.5 rounded-md shrink-0"
        style={{ backgroundColor: pr.color + '18', color: pr.color }}
        title={t(`priority.${task.priority}`)}
      >
        {pr.icon}
      </span>

      {/* Assignee avatar */}
      {assignee && (
        <div
          className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[8px] font-bold text-[var(--accent)] shrink-0"
          title={assignee.displayName || assignee.email}
        >
          {assignee.displayName?.[0]?.toUpperCase() || '?'}
        </div>
      )}

      {/* Due date */}
      {due && (
        <span
          className={`text-[11px] shrink-0 flex items-center gap-1 ${
            due < new Date() && !isDone ? 'text-red-400' : 'text-[var(--text-muted)]'
          }`}
          title={due.toLocaleDateString()}
        >
          <Calendar className="h-3 w-3" />
          {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      )}

      {/* Delete button */}
      {canUpdate && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// Main SubtaskList Component
// ============================================================

export default function SubtaskList({
  parentTaskId,
  subtasks,
  members,
  teamId,
  listId,
  userId,
  canUpdate,
  onMutate,
  maxDepth = 3,
  depth = 0,
  childrenMap = {},
}: Props) {
  const { t } = useI18n();
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Progress rollup
  const { total, done, pct } = rollupProgress(subtasks);

  // Expand / collapse
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Create new subtask
  const handleCreate = async () => {
    if (!newTitle.trim() || !canUpdate || creating) return;
    setCreating(true);
    try {
      await createSubtask(parentTaskId, {
        title: newTitle.trim(),
        teamId,
        listId: listId || undefined,
        createdBy: userId,
      });
      setNewTitle('');
      onMutate();
    } catch (err) {
      console.error('[SubtaskList] create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  // Status change
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateTask(taskId, { status: newStatus });
      onMutate();
    } catch (err) {
      console.error('[SubtaskList] status update failed:', err);
    }
  };

  return (
    <div className={depth > 0 ? 'ml-6 border-l border-[var(--border-subtle)] pl-2' : ''}>
      {/* Progress bar (top level only) */}
      {depth === 0 && total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-[var(--text-muted)]">
              {done}/{total} · {pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask rows */}
      {subtasks.map(sub => {
        const children = childrenMap[sub.id] || [];
        const hasChildren = children.length > 0 || (sub.subtaskIds && sub.subtaskIds.length > 0);
        const isExpanded = expandedIds.has(sub.id);

        return (
          <div key={sub.id}>
            <SubtaskCard
              task={sub}
              members={members}
              canUpdate={canUpdate}
              parentTaskId={parentTaskId}
              onMutate={onMutate}
              onToggleExpand={() => toggleExpand(sub.id)}
              isExpanded={isExpanded}
              hasChildren={!!hasChildren}
              onStatusChange={handleStatusChange}
            />

            {/* Nested children */}
            <AnimatePresence initial={false}>
              {isExpanded && hasChildren && depth < maxDepth - 1 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <SubtaskList
                    parentTaskId={sub.id}
                    subtasks={children}
                    members={members}
                    teamId={teamId}
                    listId={listId}
                    userId={userId}
                    canUpdate={canUpdate}
                    onMutate={onMutate}
                    maxDepth={maxDepth}
                    depth={depth + 1}
                    childrenMap={childrenMap}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Inline add input */}
      {canUpdate && (
        <div className={`flex gap-2 ${total > 0 || depth > 0 ? 'mt-2' : ''}`}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={t('taskCreate.addSubtask')}
            className="input-dark h-9 rounded-xl text-sm flex-1"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            disabled={creating}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
            className="px-3 h-9 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-40"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
