'use client';

// ============================================================
// Task Timeline View — Resource-based timeline showing tasks
// grouped by assignee as horizontal swimlanes.
// Unlike Gantt (dependency-focused), this is workload-focused:
// each row = a member, bars = their tasks across time.
// ============================================================

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { Task, TaskGroup, PRIORITY_ORDER, STATUSES, getStatusConfig } from './constants';

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

interface Swimlane {
  id: string;
  label: string;
  avatar?: string;
  tasks: TimelineTask[];
}

// ─── Constants ──────────────────────────────────────────
const COL_WIDTHS: Record<Zoom, number> = { day: 48, week: 120, month: 180 };
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 24;
const LANE_HEADER_HEIGHT = 36;
const MS_PER_DAY = 86400000;
const LABEL_WIDTH = 220;

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

// ─── Status color lookup ────────────────────────────────
function statusColor(status: string): string {
  const cfg = getStatusConfig(status);
  return cfg?.color || '#64748B';
}

// ─── Component ──────────────────────────────────────────
export default function TaskTimelineView({
  groups, members, selectedTask, onSelect,
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

  // Flatten all tasks
  const allTasks = useMemo(() => groups.flatMap(g => g.tasks), [groups]);

  // Filter to tasks with dates and enrich with parsed Date objects
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
      .sort((a, b) => a._start.getTime() - b._start.getTime());
  }, [allTasks]);

  // Build swimlanes — group tasks by assignee
  const swimlanes: Swimlane[] = useMemo(() => {
    const memberMap = new Map<string, any>();
    for (const m of members) memberMap.set(m.id, m);

    const laneMap = new Map<string, TimelineTask[]>();

    for (const task of timelineTasks) {
      if (task.assignees?.length) {
        for (const aid of task.assignees) {
          if (!laneMap.has(aid)) laneMap.set(aid, []);
          laneMap.get(aid)!.push(task);
        }
      } else {
        const key = '__unassigned__';
        if (!laneMap.has(key)) laneMap.set(key, []);
        laneMap.get(key)!.push(task);
      }
    }

    const lanes: Swimlane[] = [];
    // Members first (sorted by name)
    const memberIds = [...laneMap.keys()].filter(k => k !== '__unassigned__');
    memberIds.sort((a, b) => {
      const ma = memberMap.get(a);
      const mb = memberMap.get(b);
      return (ma?.displayName || '').localeCompare(mb?.displayName || '');
    });

    for (const id of memberIds) {
      const m = memberMap.get(id);
      lanes.push({
        id,
        label: m?.displayName || m?.email || id.slice(0, 8),
        avatar: m?.photoURL,
        tasks: laneMap.get(id)!,
      });
    }

    // Unassigned lane at the end
    if (laneMap.has('__unassigned__')) {
      lanes.push({
        id: '__unassigned__',
        label: lang === 'es' ? 'Sin asignar' : 'Unassigned',
        tasks: laneMap.get('__unassigned__')!,
      });
    }

    return lanes;
  }, [timelineTasks, members, lang]);

  // Date range + columns
  const { rangeStart, columns } = useMemo(() => {
    if (timelineTasks.length === 0) {
      const now = new Date();
      const start = addDays(now, -7);
      const end = addDays(now, 42);
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

  // Bar position helper
  const getBarStyle = useCallback((task: TimelineTask) => {
    const daysFromStart = daysBetween(rangeStart, task._start);
    const duration = Math.max(daysBetween(task._start, task._end), 1);
    return {
      left: daysFromStart * pxPerDay,
      width: Math.max(duration * pxPerDay, 18),
    };
  }, [rangeStart, pxPerDay]);

  // Today indicator offset
  const todayOffset = useMemo(() => {
    return daysBetween(rangeStart, startOfDay(new Date())) * pxPerDay;
  }, [rangeStart, pxPerDay]);

  // Column header format
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

  // Compute lane heights: each lane = header + max overlapping rows
  const laneLayouts = useMemo(() => {
    return swimlanes.map(lane => {
      // Simple stacking: assign each task to the first row where it fits
      const rows: { end: number }[] = [];
      const taskRows: number[] = [];

      for (const task of lane.tasks) {
        const { left, width } = getBarStyle(task);
        const taskEnd = left + width;
        let placed = false;
        for (let r = 0; r < rows.length; r++) {
          if (left >= rows[r].end + 4) { // 4px gap
            rows[r].end = taskEnd;
            taskRows.push(r);
            placed = true;
            break;
          }
        }
        if (!placed) {
          rows.push({ end: taskEnd });
          taskRows.push(rows.length - 1);
        }
      }

      const rowCount = Math.max(rows.length, 1);
      const height = LANE_HEADER_HEIGHT + rowCount * ROW_HEIGHT;
      return { lane, taskRows, rowCount, height };
    });
  }, [swimlanes, getBarStyle]);

  const totalHeight = laneLayouts.reduce((sum, l) => sum + l.height, 0);
  const noTasks = timelineTasks.length === 0;
  const tasksWithoutDates = allTasks.length - timelineTasks.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--text-muted)]">
            {swimlanes.length} {lang === 'es' ? 'miembros' : 'members'}
            {' · '}
            {timelineTasks.length} {lang === 'es' ? 'tareas' : 'tasks'}
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
              {z === 'day' ? (lang === 'es' ? 'Dia' : 'Day')
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
                ? 'Agrega fechas y asigna tareas para ver la linea de tiempo del equipo.'
                : 'Add dates and assign tasks to see the team timeline.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Swimlane labels */}
          <div
            ref={leftRef}
            onScroll={handleLeftScroll}
            className="overflow-y-auto overflow-x-hidden border-r border-[var(--border-subtle)] shrink-0 scrollbar-thin"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Header spacer */}
            <div className="h-10 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] sticky top-0 z-10 flex items-center px-3">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {lang === 'es' ? 'Miembro' : 'Member'}
              </span>
            </div>

            {/* Lanes */}
            {laneLayouts.map(({ lane, height }) => (
              <div key={lane.id} style={{ height }} className="border-b border-[var(--border-subtle)]/40">
                {/* Lane header */}
                <div className="flex items-center gap-2 px-3" style={{ height: LANE_HEADER_HEIGHT }}>
                  {lane.avatar ? (
                    <img src={lane.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[var(--accent)]">
                        {lane.label.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">{lane.label}</span>
                  <span className="text-[11px] text-[var(--text-muted)] ml-auto shrink-0">{lane.tasks.length}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Timeline grid */}
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

            {/* Swimlanes with task bars */}
            <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
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

              {/* Lanes + bars */}
              {(() => {
                let yOffset = 0;
                return laneLayouts.map(({ lane, taskRows, height }) => {
                  const laneY = yOffset;
                  yOffset += height;

                  return (
                    <div key={lane.id} className="absolute w-full border-b border-[var(--border-subtle)]/20"
                      style={{ top: laneY, height }}>
                      {/* Alternating lane bg */}
                      <div className="absolute inset-0 bg-[var(--bg-base)] opacity-[0.02]" />

                      {/* Task bars */}
                      {lane.tasks.map((task, idx) => {
                        const { left, width } = getBarStyle(task);
                        const row = taskRows[idx];
                        const barTop = LANE_HEADER_HEIGHT + row * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
                        const color = statusColor(task.status);
                        const isSelected = selectedTask?.id === task.id;
                        const isDone = task.status === 'done' || task.status === 'completed';

                        return (
                          <div
                            key={task.id}
                            className="absolute flex items-center"
                            style={{ top: barTop, left, width, height: BAR_HEIGHT }}
                          >
                            <div
                              onClick={() => onSelect(task)}
                              className={`h-full w-full rounded-md cursor-pointer transition-all hover:brightness-110 flex items-center ${
                                isSelected ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-base)]' : ''
                              } ${isDone ? 'opacity-50' : ''}`}
                              style={{ backgroundColor: color + '25', borderLeft: `3px solid ${color}` }}
                              title={`${task.title}\n${task._start.toLocaleDateString()} → ${task._end.toLocaleDateString()}`}
                            >
                              {width > 50 && (
                                <span className="text-[10px] font-medium text-[var(--text-primary)] truncate px-2">
                                  {task.title}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
