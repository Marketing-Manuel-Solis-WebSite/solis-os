'use client';
import { useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Task, TaskGroup } from './constants';
import TaskCard from './task-card';
import TaskQuickAdd from './task-quick-add';

interface Props {
  groups: TaskGroup[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  canUpdate: boolean;
  onSelect: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onQuickCreate: (data: any) => void;
}

export default function TaskBoardView({
  groups,
  members,
  teams,
  selectedTask,
  canUpdate,
  onSelect,
  onStatusChange,
  onQuickCreate,
}: Props) {
  const { t } = useI18n();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());

  // ─── Collapse / Expand ──────────────────────────────────────
  const toggleCollapse = useCallback((key: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // ─── Drag Handlers ──────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.4';
    el.style.transform = 'scale(0.97)';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    el.style.transform = '';
    setDraggedTask(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!(e.currentTarget as HTMLElement).contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, columnKey: string) => {
      e.preventDefault();
      if (draggedTask && draggedTask.status !== columnKey) {
        onStatusChange(draggedTask.id, columnKey);
      }
      setDraggedTask(null);
      setDragOverColumn(null);
    },
    [draggedTask, onStatusChange],
  );

  return (
    <div className="flex gap-5 overflow-x-auto h-full px-7 py-4">
      {groups.map((group) => {
        const isCollapsed = collapsedColumns.has(group.key);
        const isDragTarget = dragOverColumn === group.key;
        const isValidDrop = isDragTarget && draggedTask && draggedTask.status !== group.key;

        // ─── Collapsed Column ───────────────────────────────
        if (isCollapsed) {
          return (
            <motion.div
              key={group.key}
              layout
              initial={{ width: 44, opacity: 0.8 }}
              animate={{ width: 44, opacity: 1 }}
              exit={{ width: 290 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className={`
                w-11 shrink-0 flex flex-col items-center rounded-2xl
                border border-[var(--border-subtle)] bg-[var(--bg-elevated)]
                cursor-pointer select-none transition-colors duration-200
                hover:bg-[var(--bg-hover)]
                ${isDragTarget ? 'ring-2 ring-[var(--accent)]/25 bg-[var(--accent)]/3' : ''}
              `}
              onClick={() => toggleCollapse(group.key)}
              onDragOver={(e) => handleDragOver(e, group.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.key)}
            >
              {/* Color dot */}
              <div className="pt-3 pb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: group.color,
                    boxShadow: `0 0 10px ${group.color}35`,
                  }}
                />
              </div>

              {/* Count badge */}
              <span className="text-[12px] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-md mb-2">
                {group.tasks.length}
              </span>

              {/* Vertical label */}
              <div className="flex-1 flex items-center justify-center min-h-0">
                <span
                  className="text-[12px] font-semibold text-[var(--text-secondary)] whitespace-nowrap"
                  style={{
                    writingMode: 'vertical-lr',
                    textOrientation: 'mixed',
                    transform: 'rotate(180deg)',
                  }}
                >
                  {group.label}
                </span>
              </div>

              {/* Expand chevron */}
              <div className="pb-3 pt-2">
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </div>
            </motion.div>
          );
        }

        // ─── Expanded Column ────────────────────────────────
        return (
          <motion.div
            key={group.key}
            layout
            initial={{ width: 290, opacity: 0.8 }}
            animate={{ width: 290, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className={`
              w-[290px] shrink-0 flex flex-col rounded-2xl
              border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60
              transition-all duration-200 ease-out
              hover:bg-[var(--bg-elevated)]/70
              ${isDragTarget ? 'ring-2 ring-[var(--accent)]/25 bg-[var(--accent)]/3' : ''}
            `}
            onDragOver={(e) => handleDragOver(e, group.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, group.key)}
          >
            {/* ── Column Header ── */}
            <div className="flex items-center gap-2 mb-4 px-4 pt-4">
              {/* Color dot with glow */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: group.color,
                  boxShadow: `0 0 10px ${group.color}35`,
                }}
              />

              {/* Label */}
              <span className="text-[14px] font-semibold text-[var(--text-secondary)] truncate">
                {group.label}
              </span>

              {/* Count badge */}
              <span className="text-[12px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-lg font-medium tabular-nums min-w-[24px] h-6 flex items-center justify-center">
                {group.tasks.length}
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Collapse button */}
              <button
                onClick={() => toggleCollapse(group.key)}
                className="
                  p-1.5 rounded-lg
                  text-[var(--text-muted)] hover:text-[var(--text-secondary)]
                  hover:bg-[var(--bg-hover)]
                  transition-colors duration-150
                "
                title={t('common.collapse') || 'Collapse'}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Drop Indicator ── */}
            <AnimatePresence>
              {isValidDrop && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0.5 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0.5 }}
                  transition={{ duration: 0.15 }}
                  className="h-[3px] rounded-full bg-[var(--accent)] mx-3 mb-1"
                  style={{ boxShadow: '0 0 8px var(--accent)' }}
                />
              )}
            </AnimatePresence>

            {/* ── Card Area ── */}
            <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
              <div className="flex flex-col gap-3">
                {group.tasks.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <p className="text-[13px] text-[var(--text-muted)]">
                      {t('tasks.noTasks') || 'No tasks'}
                    </p>
                  </div>
                ) : (
                  group.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      members={members}
                      teams={teams}
                      isSelected={selectedTask?.id === task.id}
                      isDragging={draggedTask?.id === task.id}
                      onSelect={() => onSelect(task)}
                      onDragStart={canUpdate ? (e) => handleDragStart(e, task) : undefined}
                      onDragEnd={canUpdate ? handleDragEnd : undefined}
                    />
                  ))
                )}
              </div>
            </div>

            {/* ── Quick Add ── */}
            {canUpdate && (
              <div className="px-2 pb-3 pt-2">
                <TaskQuickAdd
                  groupKey={group.key}
                  groupLabel={group.label}
                  onAdd={(title) => onQuickCreate({ title, status: group.key })}
                />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
