'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, ChevronUp,
  Calendar, CheckSquare, Pencil, Trash2,
} from 'lucide-react';
import { STATUSES, PRIORITIES, TASK_TYPES, Task, TaskGroup } from './constants';
import TaskQuickAdd from './task-quick-add';

interface Props {
  groups: TaskGroup[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  selectedIds: Set<string>;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  canUpdate: boolean;
  onSelect: (task: Task) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: Task) => void;
  onSortChange: (field: string) => void;
  onQuickCreate: (data: any) => void;
}

const COLUMNS = [
  { id: 'checkbox', label: '', width: 'w-10', sortable: false },
  { id: 'status', label: 'Estado', width: 'w-10', sortable: true },
  { id: 'title', label: 'Título', width: 'flex-1', sortable: true },
  { id: 'priority', label: 'Prioridad', width: 'w-24', sortable: true },
  { id: 'assignees', label: 'Asignados', width: 'w-28', sortable: false },
  { id: 'due', label: 'Fecha', width: 'w-28', sortable: true },
  { id: 'tags', label: 'Etiquetas', width: 'w-32 hidden lg:flex', sortable: false },
  { id: 'points', label: 'Pts', width: 'w-14', sortable: true },
];

export default function TaskListView({
  groups, members, teams, selectedTask, selectedIds, sortBy, sortDir, canUpdate,
  onSelect, onSelectionChange, onUpdate, onDelete, onSortChange, onQuickCreate,
}: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    const next = new Set(collapsedGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    setCollapsedGroups(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  const selectAllInGroup = (tasks: Task[]) => {
    const next = new Set(selectedIds);
    const allSelected = tasks.every(t => next.has(t.id));
    tasks.forEach(t => allSelected ? next.delete(t.id) : next.add(t.id));
    onSelectionChange(next);
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-3">
      {/* Column Headers */}
      <div className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold sticky top-0 bg-[var(--bg-base)] z-10">
        {COLUMNS.map(col => (
          <div key={col.id}
            className={`flex items-center gap-1 ${col.width} shrink-0 ${col.sortable ? 'cursor-pointer hover:text-[var(--text-secondary)] select-none' : ''}`}
            onClick={() => col.sortable && onSortChange(col.id)}>
            {col.label}
            {col.sortable && sortBy === col.id && (
              sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            )}
          </div>
        ))}
      </div>

      {/* Groups */}
      {groups.filter(g => g.tasks.length > 0).map(group => (
        <div key={group.key} className="mt-4">
          {/* Group header */}
          <button onClick={() => toggleGroup(group.key)} className="flex items-center gap-2 mb-2 group px-1">
            {collapsedGroups.has(group.key)
              ? <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color, boxShadow: `0 0 8px ${group.color}40` }} />
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{group.label}</span>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{group.count}</span>
            <button onClick={e => { e.stopPropagation(); selectAllInGroup(group.tasks); }}
              className="ml-2 opacity-0 group-hover:opacity-100 transition text-[var(--text-muted)] hover:text-[var(--accent)]"
              title="Seleccionar todas">
              <CheckSquare className="h-3.5 w-3.5" />
            </button>
          </button>

          <AnimatePresence initial={false}>
            {!collapsedGroups.has(group.key) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-0.5">
                  {group.tasks.map((task, i) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      index={i}
                      members={members}
                      teams={teams}
                      isSelected={selectedTask?.id === task.id}
                      isChecked={selectedIds.has(task.id)}
                      canUpdate={canUpdate}
                      onSelect={() => onSelect(task)}
                      onCheck={() => toggleSelect(task.id)}
                      onUpdate={onUpdate}
                      onDelete={() => onDelete(task)}
                    />
                  ))}
                </div>
                {canUpdate && (
                  <TaskQuickAdd
                    groupKey={group.key}
                    groupLabel={group.label}
                    onAdd={(title) => onQuickCreate({ title, status: group.key })}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function TaskRow({ task, index, members, teams, isSelected, isChecked, canUpdate, onSelect, onCheck, onUpdate, onDelete }: {
  task: Task; index: number; members: any[]; teams: any[];
  isSelected: boolean; isChecked: boolean; canUpdate: boolean;
  onSelect: () => void; onCheck: () => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const st = STATUSES.find(s => s.id === task.status) || STATUSES[0];
  const p = PRIORITIES.find(x => x.id === task.priority) || PRIORITIES[2];
  const tp = TASK_TYPES.find(x => x.id === (task.type || 'task')) || TASK_TYPES[0];
  const due = task.dueDate?.toDate?.();
  const overdue = due && due < new Date() && task.status !== 'done';
  const taskTeam = teams.find((tm: any) => tm.id === task.teamId);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer group transition-all duration-200 relative anim-slide ${
        isSelected ? 'bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/20'
        : isChecked ? 'bg-[var(--accent)]/3 ring-1 ring-[var(--accent)]/10'
        : 'bg-[var(--bg-elevated)] shadow-card hover:shadow-md hover:bg-[var(--bg-hover)]'
      }`}
      style={{ animationDelay: `${Math.min(index, 20) * 15}ms` }}
    >
      {/* Checkbox */}
      <div className="w-10 shrink-0 flex justify-center" onClick={e => { e.stopPropagation(); onCheck(); }}>
        <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all duration-200 cursor-pointer ${
          isChecked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--accent)]/20'
        }`}>
          {isChecked && <span className="text-[var(--accent-text)] text-[10px] font-bold">&#10003;</span>}
        </div>
      </div>

      {/* Status */}
      <div className="w-10 shrink-0 flex justify-center">
        <button onClick={e => { e.stopPropagation(); if (canUpdate) onUpdate(task.id, 'status', task.status === 'done' ? 'todo' : 'done', task.status); }}
          className="hover:scale-110 transition" title={st.label}>
          <st.Icon className="h-5 w-5" style={{ color: st.color }} />
        </button>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <tp.Icon className="h-3.5 w-3.5 shrink-0 opacity-40" style={{ color: tp.color }} />
          <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
            {task.title}
          </p>
          {taskTeam && (
            <span className="hidden xl:flex text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
              style={{ backgroundColor: `${taskTeam.color}15`, color: taskTeam.color }}>
              {taskTeam.icon}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5 ml-5">{task.description}</p>
        )}
      </div>

      {/* Priority */}
      <div className="w-24 shrink-0 flex justify-center">
        <InlinePrioritySelect value={task.priority} canUpdate={canUpdate}
          onChange={(val) => onUpdate(task.id, 'priority', val, task.priority)} />
      </div>

      {/* Assignees */}
      <div className="w-28 shrink-0">
        <div className="flex -space-x-1.5">
          {task.assignees?.slice(0, 3).map((uid: string) => {
            const m = members.find((x: any) => x.id === uid);
            return (
              <div key={uid} className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] border-2 border-[var(--bg-base)] flex items-center justify-center text-[9px] font-bold text-[var(--accent)]">
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

      {/* Due date */}
      <div className="w-28 shrink-0">
        {due && (
          <span className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-md ${
            overdue ? 'bg-red-500/10 text-red-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }`}>
            <Calendar className="h-3 w-3" />
            {due.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Tags */}
      <div className="w-32 hidden lg:flex gap-1 shrink-0">
        {task.tags?.slice(0, 2).map((tg: string) => (
          <span key={tg} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">{tg}</span>
        ))}
      </div>

      {/* Points */}
      <div className="w-14 shrink-0 text-center">
        {task.points && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono">{task.points}pt</span>}
      </div>

      {/* Hover actions */}
      {hovered && canUpdate && (
        <div className="absolute right-3 flex items-center gap-1 z-10">
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-red-400 shadow-card transition-all duration-200"
            title="Eliminar">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function InlinePrioritySelect({ value, canUpdate, onChange }: { value: string; canUpdate: boolean; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const p = PRIORITIES.find(x => x.id === value) || PRIORITIES[2];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!canUpdate) return <span className="text-sm">{p.icon}</span>;

  return (
    <div ref={ref} className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(!open); }} className="text-sm hover:scale-110 transition" title={p.label}>
        {p.icon}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[var(--bg-base)] rounded-xl shadow-dropdown z-30 p-1 min-w-[120px]">
            {PRIORITIES.map(pri => (
              <button key={pri.id} onClick={e => { e.stopPropagation(); onChange(pri.id); setOpen(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs w-full hover:bg-[var(--bg-hover)] transition ${value === pri.id ? 'bg-[var(--bg-hover)]' : ''}`}>
                {pri.icon} {pri.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
