'use client';
import { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, GanttChart } from 'lucide-react';
import { Task, STATUSES, PRIORITIES, PRIORITY_ORDER } from '@/components/tasks/constants';
import { useI18n } from '@/lib/i18n';

interface Props {
  tasks: Task[];
  members: any[];
  selectedTask: Task | null;
  onSelect: (task: Task) => void;
  onDateRangeChange: (taskId: string, startDate: Date, endDate: Date) => void;
}

type Zoom = 'day' | 'week' | 'month';

const COL_WIDTHS: Record<Zoom, number> = { day: 40, week: 100, month: 160 };
const ROW_HEIGHT = 40;
const MS_PER_DAY = 86400000;

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

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
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

function formatColHeader(d: Date, zoom: Zoom, mesesShort: string[], mesesFull: string[]): string {
  if (zoom === 'day') return `${d.getDate()}`;
  if (zoom === 'week') return `${d.getDate()} ${mesesShort[d.getMonth()]}`;
  return `${mesesFull[d.getMonth()]} ${d.getFullYear()}`;
}

function getColGroupHeader(d: Date, zoom: Zoom, mesesFull: string[]): string | null {
  if (zoom === 'day') return `${mesesFull[d.getMonth()]} ${d.getFullYear()}`;
  return null;
}

interface TimelineTask extends Task {
  _start: Date;
  _end: Date;
}

export default function PlannerTimeline({ tasks, members, selectedTask, onSelect, onDateRangeChange }: Props) {
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

  // Filter to tasks with dates, compute start/end
  const timelineTasks: TimelineTask[] = useMemo(() => {
    return tasks
      .filter(t => t.dueDate?.toDate?.() || t.startDate?.toDate?.())
      .map(t => {
        const s = t.startDate?.toDate?.();
        const e = t.dueDate?.toDate?.();
        const start = s || e!;
        const end = e || s!;
        return { ...t, _start: startOfDay(start), _end: startOfDay(end) };
      })
      .sort((a, b) => {
        // Sort by start date, then by priority
        const dateDiff = a._start.getTime() - b._start.getTime();
        if (dateDiff !== 0) return dateDiff;
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      });
  }, [tasks]);

  // Calculate date range + columns
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

  // Bar position calculation
  const getBarStyle = useCallback((task: TimelineTask) => {
    const daysFromStart = daysBetween(rangeStart, task._start);
    const duration = Math.max(daysBetween(task._start, task._end), 1);

    let pxPerDay: number;
    if (zoom === 'day') pxPerDay = colWidth;
    else if (zoom === 'week') pxPerDay = colWidth / 7;
    else pxPerDay = colWidth / 30;

    return {
      left: daysFromStart * pxPerDay,
      width: Math.max(duration * pxPerDay, 20),
    };
  }, [rangeStart, zoom, colWidth]);

  // Today line position
  const todayOffset = useMemo(() => {
    const days = daysBetween(rangeStart, startOfDay(new Date()));
    let pxPerDay: number;
    if (zoom === 'day') pxPerDay = colWidth;
    else if (zoom === 'week') pxPerDay = colWidth / 7;
    else pxPerDay = colWidth / 30;
    return days * pxPerDay;
  }, [rangeStart, zoom, colWidth]);

  // Sync scroll
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

  // Scroll to today
  const scrollToToday = () => {
    if (rightRef.current) {
      rightRef.current.scrollLeft = Math.max(todayOffset - rightRef.current.clientWidth / 2, 0);
    }
  };

  return (
    <div className="h-full flex flex-col px-6 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('planner.timelineTitle')}</h2>
          <span className="text-sm text-[var(--text-muted)]">{t('planner.tasks', { n: timelineTasks.length })}</span>
          <button onClick={scrollToToday}
            className="text-[13px] px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all duration-200">
            {t('common.today')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom selector */}
          <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
            {(['day', 'week', 'month'] as Zoom[]).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                className={`px-3 py-1.5 text-sm transition ${
                  zoom === z
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}>
                {z === 'day' ? t('planner.day') : z === 'week' ? t('planner.week') : t('planner.month')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {timelineTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-[var(--text-muted)]">
          <GanttChart className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-base">{t('planner.noTimelineTasks')}</p>
          <p className="text-sm mt-1">{t('planner.noTimelineHint')}</p>
        </div>
      ) : (
        /* Timeline container */
        <div className="flex-1 flex overflow-hidden rounded-xl shadow-card bg-[var(--bg-elevated)]">
          {/* Left: Task names */}
          <div ref={leftRef} onScroll={handleLeftScroll}
            className="w-60 shrink-0 border-r border-[var(--border-subtle)] overflow-y-auto overflow-x-hidden"
            style={{ scrollbarWidth: 'none' }}>
            {/* Header spacer */}
            <div className="h-10 flex items-center px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-elevated)] z-10">
              {t('planner.taskLabel')}
            </div>
            {timelineTasks.map(task => {
              const pri = PRIORITIES.find(p => p.id === task.priority);
              const isSelected = selectedTask?.id === task.id;
              return (
                <div key={task.id}
                  className={`flex items-center gap-2 px-3 border-b border-[var(--border-subtle)]/30 cursor-pointer transition hover:bg-[var(--bg-hover)] ${
                    isSelected ? 'bg-[var(--accent)]/5' : ''
                  }`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onSelect(task)}>
                  <span className="text-[11px]">{pri?.icon}</span>
                  <span className={`text-sm truncate flex-1 ${
                    task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                  }`}>{task.title}</span>
                </div>
              );
            })}
          </div>

          {/* Right: Timeline grid */}
          <div ref={rightRef} onScroll={handleRightScroll}
            className="flex-1 overflow-auto relative">
            {/* Column headers */}
            <div className="sticky top-0 z-10 flex border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
              style={{ width: totalWidth, minWidth: '100%' }}>
              {columns.map((col, i) => (
                <div key={i}
                  className="flex items-center justify-center text-[11px] text-[var(--text-muted)] border-r border-[var(--border-subtle)]/30 shrink-0"
                  style={{ width: colWidth, height: 40 }}>
                  {formatColHeader(col, zoom, MESES, MESES_FULL)}
                </div>
              ))}
            </div>

            {/* Rows area */}
            <div className="relative" style={{ width: totalWidth, minWidth: '100%', height: timelineTasks.length * ROW_HEIGHT }}>
              {/* Vertical grid lines */}
              {columns.map((_, i) => (
                <div key={i}
                  className="absolute top-0 bottom-0 border-r border-[var(--border-subtle)]/15"
                  style={{ left: i * colWidth }}
                />
              ))}

              {/* Row backgrounds (alternating) */}
              {timelineTasks.map((_, i) => (
                <div key={i}
                  className={`absolute left-0 right-0 ${i % 2 === 0 ? '' : 'bg-[var(--bg-base)]/30'}`}
                  style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

              {/* Today line */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--accent)] z-20 pointer-events-none"
                style={{ left: todayOffset }}>
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--accent)]" />
              </div>

              {/* Dependency lines */}
              <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: totalWidth, height: timelineTasks.length * ROW_HEIGHT }}>
                <defs>
                  <marker id="timeline-arrow" markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="var(--text-muted)" opacity={0.5} />
                  </marker>
                </defs>
                {timelineTasks.map((task, rowIdx) =>
                  (task.dependencies || []).map(depId => {
                    const depIdx = timelineTasks.findIndex(t => t.id === depId);
                    if (depIdx === -1) return null;
                    const depTask = timelineTasks[depIdx];
                    const fromBar = getBarStyle(depTask as TimelineTask);
                    const toBar = getBarStyle(task as TimelineTask);
                    const fromX = fromBar.left + fromBar.width;
                    const fromY = depIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const toX = toBar.left;
                    const toY = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const midX = fromX + (toX - fromX) / 2;
                    return (
                      <path key={`${depId}-${task.id}`}
                        d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                        fill="none"
                        stroke="var(--text-muted)"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        opacity={0.4}
                        markerEnd="url(#timeline-arrow)"
                      />
                    );
                  })
                )}
              </svg>

              {/* Task bars */}
              {timelineTasks.map((task, rowIdx) => {
                const { left, width } = getBarStyle(task);
                const status = STATUSES.find(s => s.id === task.status);
                const barColor = status?.color || '#64748B';
                const isSelected = selectedTask?.id === task.id;

                return (
                  <div
                    key={task.id}
                    className={`absolute rounded-md cursor-pointer transition-all duration-150 hover:brightness-110 hover:shadow-md z-10 ${
                      isSelected ? 'ring-2 ring-[var(--accent)] shadow-lg' : ''
                    }`}
                    style={{
                      top: rowIdx * ROW_HEIGHT + 7,
                      left,
                      width,
                      height: ROW_HEIGHT - 14,
                      backgroundColor: barColor,
                      opacity: task.status === 'done' ? 0.45 : 0.85,
                    }}
                    onClick={() => onSelect(task)}
                    title={`${task.title}\n${task._start.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX')} → ${task._end.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX')}`}
                  >
                    <span className="text-[10px] text-white font-medium px-2 truncate block leading-[26px]">
                      {width > 60 ? task.title : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
