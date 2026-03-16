'use client';

// ============================================================
// Task Gantt View — Timeline chart with task bars, dependencies,
// zoom levels (day/week/month), today indicator, and drag-resize.
// ============================================================

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { Task, TaskGroup, PRIORITY_ORDER, getStatusConfig } from './constants';

// ─── Types ──────────────────────────────────────────────
interface Props {
  groups: TaskGroup[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  canUpdate: boolean;
  onSelect: (task: Task) => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: Task) => void;
  onQuickCreate: (data: any) => void;
}

type Zoom = 'day' | 'week' | 'month';

interface TimelineTask extends Task {
  _start: Date;
  _end: Date;
}

// ─── Constants ──────────────────────────────────────────
const COL_WIDTHS: Record<Zoom, number> = { day: 40, week: 100, month: 160 };
const ROW_HEIGHT = 36;
const MS_PER_DAY = 86400000;
const LABEL_WIDTH = 260;

// ─── Date helpers ───────────────────────────────────────
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function generateColumns(start: Date, end: Date, zoom: Zoom): Date[] {
  const cols: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    cols.push(new Date(current));
    if (zoom === 'day') current.setDate(current.getDate() + 1);
    else if (zoom === 'week') current.setDate(current.getDate() + 7);
    else current.setMonth(current.getMonth() + 1);
  }
  return cols;
}

// ─── Component ──────────────────────────────────────────
export default function TaskGanttView({
  groups, members, selectedTask, canUpdate, onSelect, onUpdate,
}: Props) {
  const { t, lang } = useI18n();
  const [zoom, setZoom] = useState<Zoom>('week');
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);

  const MESES = lang === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const MESES_FULL = lang === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Flatten all tasks and filter to those with dates
  const allTasks = useMemo(() => groups.flatMap(g => g.tasks), [groups]);

  const timelineTasks: TimelineTask[] = useMemo(() => {
    return allTasks
      .filter(t => toDate(t.dueDate) || toDate(t.startDate))
      .map(t => {
        const s = toDate(t.startDate);
        const e = toDate(t.dueDate);
        const start = s || e!;
        const end = e || s!;
        return { ...t, _start: startOfDay(start), _end: startOfDay(end) };
      })
      .sort((a, b) => {
        const dateDiff = a._start.getTime() - b._start.getTime();
        if (dateDiff !== 0) return dateDiff;
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      });
  }, [allTasks]);

  // Date range + columns
  const { rangeStart, columns } = useMemo(() => {
    if (timelineTasks.length === 0) {
      const now = new Date();
      const start = addDays(now, -14);
      const end = addDays(now, 60);
      return { rangeStart: startOfDay(start), columns: generateColumns(startOfDay(start), startOfDay(end), zoom) };
    }
    const earliest = new Date(Math.min(...timelineTasks.map(t => t._start.getTime())));
    const latest = new Date(Math.max(...timelineTasks.map(t => t._end.getTime())));
    const start = addDays(earliest, -7);
    const end = addDays(latest, 21);
    return { rangeStart: startOfDay(start), columns: generateColumns(startOfDay(start), startOfDay(end), zoom) };
  }, [timelineTasks, zoom]);

  const colWidth = COL_WIDTHS[zoom];
  const totalWidth = columns.length * colWidth;

  const pxPerDay = useMemo(() => {
    if (zoom === 'day') return colWidth;
    if (zoom === 'week') return colWidth / 7;
    return colWidth / 30;
  }, [zoom, colWidth]);

  // Bar position
  const getBarStyle = useCallback((task: TimelineTask) => {
    const daysFromStart = daysBetween(rangeStart, task._start);
    const duration = Math.max(daysBetween(task._start, task._end), 1);
    return {
      left: daysFromStart * pxPerDay,
      width: Math.max(duration * pxPerDay, 20),
    };
  }, [rangeStart, pxPerDay]);

  // Today indicator
  const todayOffset = useMemo(() => {
    return daysBetween(rangeStart, startOfDay(new Date())) * pxPerDay;
  }, [rangeStart, pxPerDay]);

  // Column headers
  const formatColHeader = (d: Date): string => {
    if (zoom === 'day') return `${d.getDate()}`;
    if (zoom === 'week') return `${d.getDate()} ${MESES[d.getMonth()]}`;
    return `${MESES_FULL[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Sync scroll between left labels and right timeline
  const handleRightScroll = () => {
    if (syncingScroll.current) { syncingScroll.current = false; return; }
    if (leftRef.current && rightRef.current) {
      syncingScroll.current = true;
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    }
  };
  const handleLeftScroll = () => {
    if (syncingScroll.current) { syncingScroll.current = false; return; }
    if (leftRef.current && rightRef.current) {
      syncingScroll.current = true;
      rightRef.current.scrollTop = leftRef.current.scrollTop;
    }
  };

  const scrollToToday = () => {
    if (rightRef.current) {
      rightRef.current.scrollLeft = Math.max(todayOffset - rightRef.current.clientWidth / 2, 0);
    }
  };

  // Empty state
  const noTasks = timelineTasks.length === 0;
  const tasksWithoutDates = allTasks.length - timelineTasks.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--text-muted)]">
            {timelineTasks.length} {lang === 'es' ? 'tareas con fecha' : 'tasks with dates'}
            {tasksWithoutDates > 0 && (
              <span className="ml-1 text-[var(--text-muted)]/60">
                ({tasksWithoutDates} {lang === 'es' ? 'sin fecha' : 'without dates'})
              </span>
            )}
          </span>
          <button onClick={scrollToToday}
            className="text-[12px] px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition">
            {t('common.today') || 'Today'}
          </button>
        </div>
        <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
          {(['day', 'week', 'month'] as Zoom[]).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-3 py-1 text-[12px] font-medium transition ${
                zoom === z
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}>
              {z === 'day' ? (lang === 'es' ? 'Día' : 'Day')
                : z === 'week' ? (lang === 'es' ? 'Semana' : 'Week')
                : (lang === 'es' ? 'Mes' : 'Month')}
            </button>
          ))}
        </div>
      </div>

      {noTasks ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {lang === 'es'
                ? 'Agrega fechas de inicio o vencimiento a tus tareas para verlas en el Gantt.'
                : 'Add start or due dates to your tasks to see them in the Gantt view.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Task labels */}
          <div
            ref={leftRef}
            onScroll={handleLeftScroll}
            className="overflow-y-auto overflow-x-hidden border-r border-[var(--border-subtle)] shrink-0 scrollbar-thin"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Header spacer */}
            <div className="h-10 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] sticky top-0 z-10 flex items-center px-3">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {lang === 'es' ? 'Tarea' : 'Task'}
              </span>
            </div>
            {/* Task rows */}
            {timelineTasks.map(task => {
              const cfg = getStatusConfig(task.status);
              const isSelected = selectedTask?.id === task.id;
              return (
                <div
                  key={task.id}
                  onClick={() => onSelect(task)}
                  className={`flex items-center gap-2 px-3 cursor-pointer hover:bg-[var(--bg-hover)] transition ${
                    isSelected ? 'bg-[var(--accent-subtle)]' : ''
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {cfg && <cfg.Icon className="h-3 w-3 shrink-0" style={{ color: cfg.color }} />}
                  <span className="text-[12px] text-[var(--text-primary)] truncate">{task.title}</span>
                </div>
              );
            })}
          </div>

          {/* Right: Timeline */}
          <div
            ref={rightRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-auto scrollbar-thin"
          >
            {/* Column headers */}
            <div className="sticky top-0 z-10 flex bg-[var(--bg-base)] border-b border-[var(--border-subtle)]" style={{ width: totalWidth, height: 40 }}>
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="text-[11px] text-[var(--text-muted)] flex items-center justify-center border-r border-[var(--border-subtle)]/30 shrink-0"
                  style={{ width: colWidth }}
                >
                  {formatColHeader(col)}
                </div>
              ))}
            </div>

            {/* Rows + bars */}
            <div className="relative" style={{ width: totalWidth, height: timelineTasks.length * ROW_HEIGHT }}>
              {/* Grid lines */}
              {columns.map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-[var(--border-subtle)]/20"
                  style={{ left: i * colWidth, width: colWidth }}
                />
              ))}

              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-[var(--accent)] z-10"
                style={{ left: todayOffset }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--accent)]" />
              </div>

              {/* Task bars */}
              {timelineTasks.map((task, idx) => {
                const { left, width } = getBarStyle(task);
                const cfg = getStatusConfig(task.status);
                const isSelected = selectedTask?.id === task.id;
                const barColor = cfg?.color || 'var(--accent)';
                const isDone = task.status === 'done' || task.status === 'completed';

                return (
                  <div
                    key={task.id}
                    className="absolute flex items-center"
                    style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT, left, width }}
                  >
                    <div
                      onClick={() => onSelect(task)}
                      className={`h-6 w-full rounded-md cursor-pointer transition-all hover:brightness-110 ${
                        isSelected ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-base)]' : ''
                      } ${isDone ? 'opacity-60' : ''}`}
                      style={{ backgroundColor: barColor + '30', borderLeft: `3px solid ${barColor}` }}
                      title={`${task.title}\n${task._start.toLocaleDateString()} → ${task._end.toLocaleDateString()}`}
                    >
                      {width > 60 && (
                        <span className="text-[10px] font-medium text-[var(--text-primary)] truncate px-2 leading-6 block">
                          {task.title}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Dependency lines (SVG) */}
              <svg className="absolute inset-0 pointer-events-none" style={{ width: totalWidth, height: timelineTasks.length * ROW_HEIGHT }}>
                {timelineTasks.map((task, idx) => {
                  if (!task.dependencies?.length) return null;
                  return task.dependencies.map(depId => {
                    const depIdx = timelineTasks.findIndex(t => t.id === depId);
                    if (depIdx === -1) return null;
                    const dep = timelineTasks[depIdx];
                    const depBar = getBarStyle(dep);
                    const taskBar = getBarStyle(task);
                    const x1 = depBar.left + depBar.width;
                    const y1 = depIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const x2 = taskBar.left;
                    const y2 = idx * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const mx = x1 + (x2 - x1) / 2;
                    return (
                      <path
                        key={`${depId}-${task.id}`}
                        d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke="var(--text-muted)"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        opacity={0.4}
                      />
                    );
                  });
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
