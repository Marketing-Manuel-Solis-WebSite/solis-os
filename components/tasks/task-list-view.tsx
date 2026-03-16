'use client';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, ChevronUp, Calendar,
  CheckSquare, Trash2, GripVertical, Paperclip, Repeat,
  CheckCircle2, Plus, CornerDownRight,
} from 'lucide-react';
import {
  STATUSES, PRIORITIES, TASK_TYPES, ALL_COLUMNS,
  Task, TaskGroup, Density, SubtaskDisplay, ColumnDef,
  getStatusConfig, getPriorityConfig, getTypeConfig, isOverdue, getSubtaskProgress,
} from './constants';
import TaskQuickAdd from './task-quick-add';

/* ============================================= */
/* TYPES                                         */
/* ============================================= */

interface Props {
  groups: TaskGroup[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  selectedIds: Set<string>;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  canUpdate: boolean;
  density: Density;
  columns: string[];
  subtaskDisplay: SubtaskDisplay;
  onSelect: (task: Task) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: Task) => void;
  onSortChange: (field: string) => void;
  onQuickCreate: (data: any) => void;
}

/* ============================================= */
/* DENSITY -> ROW HEIGHT MAP                     */
/* ============================================= */

const DENSITY_HEIGHT: Record<Density, number> = {
  compact: 36,
  comfortable: 48,
  spacious: 56,
};

/* ============================================= */
/* HELPERS                                       */
/* ============================================= */

function formatDate(d: Date, locale = 'es-MX'): string {
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatMinutes(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h${rem}m` : `${h}h`;
  }
  return `${m}m`;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ============================================= */
/* INLINE PRIORITY SELECT                        */
/* ============================================= */

function InlinePrioritySelect({
  value,
  canUpdate,
  onChange,
}: {
  value: string;
  canUpdate: boolean;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const p = getPriorityConfig(value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!canUpdate) {
    return (
      <span className="text-[15px]" title={t(`priority.${p.id}`)}>
        {p.icon}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-[15px] hover:scale-110 hover:ring-1 hover:ring-[var(--border)] hover:rounded-md transition"
        title={t(`priority.${p.id}`)}
      >
        {p.icon}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[var(--bg-base)] rounded-xl shadow-dropdown z-30 p-1 min-w-[130px] border border-[var(--border-subtle)]"
          >
            {PRIORITIES.map((pri) => (
              <button
                key={pri.id}
                onClick={(e) => { e.stopPropagation(); onChange(pri.id); setOpen(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm w-full hover:bg-[var(--bg-hover)] transition ${
                  value === pri.id ? 'bg-[var(--bg-hover)]' : ''
                }`}
              >
                <span>{pri.icon}</span>
                <span className="text-[var(--text-secondary)]">{t(`priority.${pri.id}`)}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================= */
/* INLINE DATE EDITOR                            */
/* ============================================= */

function InlineDateEditor({
  value,
  overdue,
  canUpdate,
  onChange,
}: {
  value: Date | null;
  overdue: boolean;
  canUpdate: boolean;
  onChange: (dateStr: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canUpdate) setEditing(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value ? toDateInputValue(value) : ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setEditing(false)}
        onClick={(e) => e.stopPropagation()}
        className="input-dark text-[12px] h-7 w-full rounded-md px-1.5"
      />
    );
  }

  if (!value) {
    if (!canUpdate) return null;
    return (
      <button
        onClick={handleClick}
        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition opacity-0 group-hover/row:opacity-100"
      >
        <Calendar className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`text-[12px] font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg truncate ${
        canUpdate ? 'cursor-pointer hover:ring-1 hover:ring-[var(--accent)]/30' : ''
      } ${
        overdue
          ? 'bg-[var(--error)]/8 text-[var(--error)] border border-[var(--error)]/15'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
      }`}
    >
      <Calendar className="h-3 w-3 shrink-0" />
      {formatDate(value)}
    </span>
  );
}

/* ============================================= */
/* SUBTASK INDICATORS                            */
/* ============================================= */

function SubtaskCount({ task }: { task: Task }) {
  const { done, total } = getSubtaskProgress(task);
  if (total === 0) return null;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-medium whitespace-nowrap">
      {done}/{total}
    </span>
  );
}

function SubtaskProgressBar({ task }: { task: Task }) {
  const { pct, total } = getSubtaskProgress(task);
  if (total === 0) return null;
  return (
    <div className="w-full h-1 rounded-full bg-[var(--bg-tertiary)] mt-1 overflow-hidden max-w-[160px]">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SubtaskExpandedList({
  task,
  canUpdate,
  onUpdate,
}: {
  task: Task;
  canUpdate: boolean;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleSubtask = (subId: string, currentDone: boolean) => {
    const updated = task.subtasks.map((s) =>
      s.id === subId ? { ...s, done: !currentDone } : s
    );
    onUpdate(task.id, 'subtasks', updated, task.subtasks);
  };

  const addSubtask = () => {
    if (!newSubTitle.trim()) return;
    const updated = [
      ...(task.subtasks || []),
      { id: Date.now().toString(), title: newSubTitle.trim(), done: false },
    ];
    onUpdate(task.id, 'subtasks', updated, task.subtasks);
    setNewSubTitle('');
    // Keep input open for rapid entry
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  if (!task.subtasks?.length && !canUpdate) return null;

  return (
    <div className="ml-10 mt-1 space-y-0.5" onClick={(e) => e.stopPropagation()}>
      {(task.subtasks || []).map((sub) => (
        <div
          key={sub.id}
          className="flex items-center gap-2 py-0.5 text-[13px]"
        >
          <button
            onClick={() => canUpdate && toggleSubtask(sub.id, sub.done)}
            className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition ${
              sub.done
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--accent)]/20'
            }`}
          >
            {sub.done && <span className="text-[9px] font-bold leading-none">&#10003;</span>}
          </button>
          <span className={sub.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}>
            {sub.title}
          </span>
        </div>
      ))}

      {/* Inline add subtask */}
      {canUpdate && (
        adding ? (
          <div className="flex items-center gap-2 py-0.5">
            <input
              ref={inputRef}
              value={newSubTitle}
              onChange={(e) => setNewSubTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
                if (e.key === 'Escape') { setAdding(false); setNewSubTitle(''); }
              }}
              onBlur={() => {
                if (!newSubTitle.trim()) { setAdding(false); setNewSubTitle(''); }
              }}
              placeholder={t('taskCreate.addSubtask')}
              className="flex-1 h-6 text-[13px] bg-transparent text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none border-b border-[var(--border-subtle)] focus:border-[var(--accent)] transition"
            />
            <button
              onClick={addSubtask}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition p-0.5"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 py-0.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] transition"
          >
            <Plus className="h-3 w-3" />
            {t('taskCreate.addSubtask')}
          </button>
        )
      )}
    </div>
  );
}

/* ============================================= */
/* TASK ROW (memoized)                           */
/* ============================================= */

const TaskRow = React.memo(function TaskRow({
  task,
  index,
  members,
  teams,
  isSelected,
  isChecked,
  canUpdate,
  density,
  columns,
  subtaskDisplay,
  onSelect,
  onCheck,
  onUpdate,
  onDelete,
}: {
  task: Task;
  index: number;
  members: any[];
  teams: any[];
  isSelected: boolean;
  isChecked: boolean;
  canUpdate: boolean;
  density: Density;
  columns: string[];
  subtaskDisplay: SubtaskDisplay;
  onSelect: () => void;
  onCheck: () => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);

  const statusCfg = getStatusConfig(task.status);
  const priorityCfg = getPriorityConfig(task.priority);
  const typeCfg = getTypeConfig(task.type || 'task');
  const due = task.dueDate?.toDate?.() ?? null;
  const overdue = isOverdue(task);
  const taskTeam = teams.find((tm: any) => tm.id === task.teamId);
  const rowHeight = Math.max(DENSITY_HEIGHT[density], 44);

  const columnSet = new Set(columns);
  const visibleCols = ALL_COLUMNS.filter((c) => columnSet.has(c.id));

  const isDone = task.status === 'done';

  // Nesting depth for subtask indentation
  const nestDepth = task.parentTaskId ? (task.subtaskDepth ?? 1) : 0;
  const nestIndent = nestDepth * 24; // 24px per level

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index, 20) * 0.015 }}
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`group/row flex items-center gap-2 px-5 rounded-xl cursor-pointer transition-all duration-150 relative border ${
          isSelected
            ? 'bg-[var(--accent)]/8 border-[var(--accent)]/25 shadow-sm'
            : isChecked
            ? 'bg-[var(--accent)]/5 border-[var(--accent)]/15'
            : 'border-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)] hover:shadow-sm'
        }`}
        style={{ height: `${rowHeight}px`, paddingLeft: nestIndent > 0 ? `${20 + nestIndent}px` : undefined }}
      >
        {/* Render each visible column */}
        {visibleCols.map((col) => {
          const widthCls = `${col.width} ${col.minWidth || ''} shrink-0`;

          switch (col.id) {
            /* ----- CHECKBOX ----- */
            case 'checkbox':
              return (
                <div
                  key={col.id}
                  className={`${widthCls} flex justify-center`}
                  onClick={(e) => { e.stopPropagation(); onCheck(); }}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isChecked
                        ? 'bg-[var(--accent)]'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--accent)]/20'
                    }`}
                  >
                    {isChecked && (
                      <span className="text-[var(--accent-text)] text-[11px] font-bold leading-none">&#10003;</span>
                    )}
                  </div>
                </div>
              );

            /* ----- STATUS (ClickUp-style toggle) ----- */
            case 'status':
              return (
                <div key={col.id} className={`${widthCls} flex justify-center`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canUpdate) {
                        onUpdate(task.id, 'status', isDone ? 'todo' : 'done', task.status);
                      }
                    }}
                    className="group/status relative w-6 h-6 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110"
                    title={isDone ? t('status.todo') : t('status.done')}
                  >
                    {/* Default icon */}
                    <statusCfg.Icon
                      className="h-[18px] w-[18px] transition-opacity duration-150 group-hover/status:opacity-0"
                      style={{ color: statusCfg.color }}
                    />
                    {/* Hover: green check (or undo circle for done) */}
                    {canUpdate && (
                      isDone ? (
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/status:opacity-100 transition-opacity duration-150">
                          <span className="w-[18px] h-[18px] rounded-full border-2 border-[var(--text-muted)]" />
                        </span>
                      ) : (
                        <CheckCircle2
                          className="absolute h-[18px] w-[18px] opacity-0 group-hover/status:opacity-100 transition-opacity duration-150"
                          style={{ color: '#22C55E' }}
                        />
                      )
                    )}
                  </button>
                </div>
              );

            /* ----- TITLE ----- */
            case 'title':
              return (
                <div key={col.id} className={`${widthCls} min-w-0`}>
                  <div className="flex items-center gap-2">
                    {/* Subtask nesting connector */}
                    {nestDepth > 0 && (
                      <CornerDownRight
                        className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-40"
                      />
                    )}
                    <typeCfg.Icon
                      className="h-3.5 w-3.5 shrink-0 opacity-50"
                      style={{ color: typeCfg.color }}
                    />
                    <p
                      className={`text-[14px] font-medium truncate ${
                        isDone
                          ? 'line-through text-[var(--text-muted)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {task.title}
                    </p>
                    {/* "Subtask" label for nested tasks */}
                    {nestDepth > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-medium whitespace-nowrap shrink-0">
                        subtask
                      </span>
                    )}
                    {taskTeam && (
                      <span
                        className="hidden xl:inline-flex text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
                        style={{ backgroundColor: `${taskTeam.color}15`, color: taskTeam.color }}
                      >
                        {taskTeam.icon}
                      </span>
                    )}
                    {task.attachments?.length > 0 && (
                      <Paperclip className="h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-60" />
                    )}
                    {task.recurrence && (
                      <span title={t('common.recurring')}>
                        <Repeat className="h-3 w-3 shrink-0 text-[var(--accent)] opacity-70" />
                      </span>
                    )}
                    {subtaskDisplay === 'count' && <SubtaskCount task={task} />}
                  </div>
                  {subtaskDisplay === 'progress' && <SubtaskProgressBar task={task} />}
                </div>
              );

            /* ----- PRIORITY ----- */
            case 'priority':
              return (
                <div key={col.id} className={`${widthCls} flex justify-center`}>
                  <InlinePrioritySelect
                    value={task.priority}
                    canUpdate={canUpdate}
                    onChange={(val) => onUpdate(task.id, 'priority', val, task.priority)}
                  />
                </div>
              );

            /* ----- ASSIGNEES ----- */
            case 'assignees':
              return (
                <div key={col.id} className={`${widthCls}`}>
                  <div className="flex -space-x-1.5">
                    {task.assignees?.slice(0, 3).map((uid: string) => {
                      const m = members.find((x: any) => x.id === uid);
                      return (
                        <div
                          key={uid}
                          className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] border-2 border-[var(--bg-base)] flex items-center justify-center text-[9px] font-bold text-[var(--accent)]"
                          title={m?.displayName || m?.email || uid}
                        >
                          {m?.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      );
                    })}
                    {(task.assignees?.length || 0) > 3 && (
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-elevated)] border-2 border-[var(--bg-base)] flex items-center justify-center text-[8px] text-[var(--text-muted)]">
                        +{task.assignees.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );

            /* ----- DUE DATE ----- */
            case 'due':
              return (
                <div key={col.id} className={`${widthCls}`}>
                  <InlineDateEditor
                    value={due}
                    overdue={overdue}
                    canUpdate={canUpdate}
                    onChange={(dateStr) => {
                      onUpdate(task.id, 'dueDate', dateStr, task.dueDate);
                    }}
                  />
                </div>
              );

            /* ----- TAGS ----- */
            case 'tags':
              return (
                <div key={col.id} className={`${widthCls} flex gap-1 items-center overflow-hidden`}>
                  {task.tags?.slice(0, 2).map((tg: string) => (
                    <span
                      key={tg}
                      className="text-[11px] px-2.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] truncate max-w-[60px]"
                    >
                      {tg}
                    </span>
                  ))}
                  {(task.tags?.length || 0) > 2 && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      +{task.tags.length - 2}
                    </span>
                  )}
                </div>
              );

            /* ----- POINTS ----- */
            case 'points':
              return (
                <div key={col.id} className={`${widthCls} text-center`}>
                  {task.points != null && task.points > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono">
                      {task.points}pt
                    </span>
                  )}
                </div>
              );

            /* ----- TYPE ----- */
            case 'type':
              return (
                <div key={col.id} className={`${widthCls} flex items-center gap-1`}>
                  <typeCfg.Icon className="h-3.5 w-3.5" style={{ color: typeCfg.color }} />
                  <span className="text-[11px] text-[var(--text-muted)] truncate">
                    {t(`taskType.${typeCfg.id}`)}
                  </span>
                </div>
              );

            /* ----- TIME ESTIMATE ----- */
            case 'timeEstimate':
              return (
                <div key={col.id} className={`${widthCls} text-center`}>
                  {task.timeEstimate != null && task.timeEstimate > 0 && (
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {formatMinutes(task.timeEstimate)}
                    </span>
                  )}
                </div>
              );

            /* ----- CREATED ----- */
            case 'created':
              return (
                <div key={col.id} className={`${widthCls}`}>
                  {task.createdAt?.toDate && (
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {formatDate(task.createdAt.toDate())}
                    </span>
                  )}
                </div>
              );

            /* ----- TEAM ----- */
            case 'team':
              return (
                <div key={col.id} className={`${widthCls} flex items-center gap-1 overflow-hidden`}>
                  {taskTeam && (
                    <>
                      <span className="text-[12px] shrink-0">{taskTeam.icon}</span>
                      <span className="text-[11px] text-[var(--text-muted)] truncate">
                        {taskTeam.name}
                      </span>
                    </>
                  )}
                </div>
              );

            default:
              return null;
          }
        })}

        {/* Hover delete action */}
        {hovered && canUpdate && (
          <div className="absolute right-3 flex items-center gap-1 z-10">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 rounded-xl bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-red-400 shadow-md transition-all duration-200"
              title={t('common.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </motion.div>

      {/* Expanded subtasks below the row (always show in expanded mode for inline add) */}
      {subtaskDisplay === 'expanded' && (
        <SubtaskExpandedList task={task} canUpdate={canUpdate} onUpdate={onUpdate} />
      )}
    </>
  );
});

/* ============================================= */
/* VIRTUALIZED GROUP CONTENT                     */
/* ============================================= */

function VirtualizedGroupContent({
  tasks,
  members,
  teams,
  selectedTask,
  selectedIds,
  canUpdate,
  density,
  columns,
  subtaskDisplay,
  onSelect,
  onToggleSelect,
  onUpdate,
  onDelete,
}: {
  tasks: Task[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  selectedIds: Set<string>;
  canUpdate: boolean;
  density: Density;
  columns: string[];
  subtaskDisplay: SubtaskDisplay;
  onSelect: (task: Task) => void;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: Task) => void;
}) {
  const rowHeight = Math.max(DENSITY_HEIGHT[density], 44) + 4; // +4 for spacing
  const VIRTUALIZE_THRESHOLD = 50;

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Only virtualize if many tasks
  if (tasks.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className="space-y-1">
        {tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            index={i}
            members={members}
            teams={teams}
            isSelected={selectedTask?.id === task.id}
            isChecked={selectedIds.has(task.id)}
            canUpdate={canUpdate}
            density={density}
            columns={columns}
            subtaskDisplay={subtaskDisplay}
            onSelect={() => onSelect(task)}
            onCheck={() => onToggleSelect(task.id)}
            onUpdate={onUpdate}
            onDelete={() => onDelete(task)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      style={{ maxHeight: '60vh', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const task = tasks[virtualRow.index];
          return (
            <div
              key={task.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TaskRow
                task={task}
                index={virtualRow.index}
                members={members}
                teams={teams}
                isSelected={selectedTask?.id === task.id}
                isChecked={selectedIds.has(task.id)}
                canUpdate={canUpdate}
                density={density}
                columns={columns}
                subtaskDisplay={subtaskDisplay}
                onSelect={() => onSelect(task)}
                onCheck={() => onToggleSelect(task.id)}
                onUpdate={onUpdate}
                onDelete={() => onDelete(task)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================= */
/* MAIN COMPONENT                                */
/* ============================================= */

export default function TaskListView({
  groups,
  members,
  teams,
  selectedTask,
  selectedIds,
  sortBy,
  sortDir,
  canUpdate,
  density,
  columns,
  subtaskDisplay,
  onSelect,
  onSelectionChange,
  onUpdate,
  onDelete,
  onSortChange,
  onQuickCreate,
}: Props) {
  const { t } = useI18n();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  /* Derive visible column definitions */
  const columnSet = new Set(columns);
  const visibleCols = ALL_COLUMNS.filter((c) => columnSet.has(c.id));

  /* Group toggle */
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /* Selection helpers */
  const toggleSelect = useCallback((id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const selectAllInGroup = (tasks: Task[]) => {
    const next = new Set(selectedIds);
    const allSelected = tasks.every((tk) => next.has(tk.id));
    tasks.forEach((tk) => (allSelected ? next.delete(tk.id) : next.add(tk.id)));
    onSelectionChange(next);
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-3">
      {/* ========= Column Headers ========= */}
      <div className="flex items-center gap-2 px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold sticky top-0 bg-[var(--bg-base)]/95 backdrop-blur-sm z-10 border-b border-[var(--border)]">
        {visibleCols.map((col) => (
          <div
            key={col.id}
            className={`flex items-center gap-1 ${col.width} ${col.minWidth || ''} shrink-0 ${
              col.sortable
                ? 'cursor-pointer hover:text-[var(--text-secondary)] select-none transition'
                : ''
            }`}
            onClick={() => col.sortable && onSortChange(col.id)}
          >
            <span className="truncate">
              {col.labelKey ? t(col.labelKey) : ''}
            </span>
            {col.sortable && sortBy === col.id && (
              sortDir === 'asc'
                ? <ChevronUp className="h-3 w-3 shrink-0" />
                : <ChevronDown className="h-3 w-3 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* ========= Groups ========= */}
      {groups
        .filter((g) => g.tasks.length > 0)
        .map((group) => {
          const isCollapsed = collapsedGroups.has(group.key);
          const allChecked =
            group.tasks.length > 0 && group.tasks.every((tk) => selectedIds.has(tk.id));

          return (
            <div key={group.key} className="mt-6">
              {/* Group Header */}
              <div
                onClick={() => toggleGroup(group.key)}
                className="flex items-center gap-2 mb-3 group/header px-1 cursor-pointer select-none"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] transition-transform" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] transition-transform" />
                )}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: group.color,
                    boxShadow: `0 0 8px ${group.color}50`,
                  }}
                />
                <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
                  {group.label}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md h-5 min-w-[24px] flex items-center justify-center font-medium">
                  {group.count}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAllInGroup(group.tasks);
                  }}
                  className={`ml-1 transition text-[var(--text-muted)] hover:text-[var(--accent)] ${
                    allChecked ? 'opacity-100 text-[var(--accent)]' : 'opacity-0 group-hover/header:opacity-100'
                  }`}
                  title={t('tasks.all')}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Group Content */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <VirtualizedGroupContent
                      tasks={group.tasks}
                      members={members}
                      teams={teams}
                      selectedTask={selectedTask}
                      selectedIds={selectedIds}
                      canUpdate={canUpdate}
                      density={density}
                      columns={columns}
                      subtaskDisplay={subtaskDisplay}
                      onSelect={onSelect}
                      onToggleSelect={toggleSelect}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                    />

                    {/* Quick Add at bottom of group */}
                    {canUpdate && (
                      <div className="mt-2">
                        <TaskQuickAdd
                          groupKey={group.key}
                          groupLabel={group.label}
                          onAdd={(title) =>
                            onQuickCreate({ title, status: group.key })
                          }
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

      {/* Empty state when all groups have 0 tasks */}
      {groups.every((g) => g.tasks.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <CheckSquare className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t('tasks.noTasks')}</p>
        </div>
      )}
    </div>
  );
}
