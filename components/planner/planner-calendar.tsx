'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Task, getStatusConfig, getPriorityConfig } from '@/components/tasks/constants';
import { useI18n } from '@/lib/i18n';

interface Props {
  tasks: Task[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  onSelect: (task: Task) => void;
  onDateChange: (taskId: string, newDate: Date) => void;
}

type CalMode = 'month' | 'week' | 'day';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDays(d: Date): Date[] {
  const monday = getMonday(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Calendar Event Chip (consistent with task calendar) ──
function PlannerEvent({
  task,
  isSelected,
  onSelect,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const statusCfg = getStatusConfig(task.status);
  const priorityCfg = getPriorityConfig(task.priority);
  const isDone = task.status === 'done';

  return (
    <button
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`
        w-full text-left px-2 py-1.5 rounded-lg text-[12px] leading-snug font-medium
        transition-all duration-150 cursor-pointer
        flex items-center gap-1.5 min-h-[28px]
        border border-transparent
        ${isSelected
          ? 'ring-2 ring-[var(--accent)] shadow-sm border-[var(--accent)]/20'
          : 'hover:shadow-sm hover:border-[var(--border)]'
        }
        ${isDone ? 'line-through opacity-50' : ''}
      `}
      style={{
        backgroundColor: isSelected ? 'var(--accent-subtle)' : `${statusCfg.color}12`,
        color: isSelected ? 'var(--accent)' : statusCfg.color,
        borderLeft: `3px solid ${statusCfg.color}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: priorityCfg.color }}
      />
      <span className="truncate">{task.title}</span>
    </button>
  );
}

// ── Day View Task Card (richer for single-day) ──
function DayViewCard({
  task,
  isSelected,
  members,
  onSelect,
}: {
  task: Task;
  isSelected: boolean;
  members: any[];
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const statusCfg = getStatusConfig(task.status);
  const priorityCfg = getPriorityConfig(task.priority);
  const isDone = task.status === 'done';
  const assigneeNames = task.assignees?.slice(0, 2).map((uid: string) => {
    const m = members.find((x: any) => x.id === uid);
    return m?.displayName || m?.email || '';
  }).filter(Boolean);

  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200
        flex items-center gap-3
        ${isSelected
          ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent)]/20 shadow-md'
          : 'bg-[var(--bg-base)] border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm'
        }
        ${isDone ? 'opacity-50' : ''}
      `}
      style={{ borderLeft: `4px solid ${statusCfg.color}` }}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: priorityCfg.color }} />
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] font-medium truncate ${isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
          {task.title}
        </p>
        {assigneeNames && assigneeNames.length > 0 && (
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">
            {assigneeNames.join(', ')}
          </p>
        )}
      </div>
      <span className="text-[11px] px-2.5 py-1 rounded-lg font-medium shrink-0" style={{ backgroundColor: `${statusCfg.color}15`, color: statusCfg.color }}>
        {t(`status.${statusCfg.id}`)}
      </span>
    </button>
  );
}

export default function PlannerCalendar({ tasks, members, teams, selectedTask, onSelect, onDateChange }: Props) {
  const { t, lang } = useI18n();
  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalMode>('month');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Locale-aware weekday names (Monday-based)
  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2020, 0, 6 + i)));
  }, [locale]);

  // Month name
  const monthName = useMemo(() => {
    const raw = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [locale, year, month]);

  // Navigation
  const prev = () => {
    if (mode === 'month') setCurrentDate(new Date(year, month - 1, 1));
    else if (mode === 'week') setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getTime() - 86400000));
  };
  const next = () => {
    if (mode === 'month') setCurrentDate(new Date(year, month + 1, 1));
    else if (mode === 'week') setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getTime() + 86400000));
  };
  const goToday = () => setCurrentDate(new Date());

  // Navigation title
  const title = useMemo(() => {
    if (mode === 'month') return `${monthName} ${year}`;
    if (mode === 'week') {
      const weekDays = getWeekDays(currentDate);
      const mon = weekDays[0];
      const sun = weekDays[6];
      const fmtDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
      if (mon.getMonth() === sun.getMonth()) {
        return `${mon.getDate()} \u2013 ${fmtDay.format(sun)}, ${sun.getFullYear()}`;
      }
      return `${fmtDay.format(mon)} \u2013 ${fmtDay.format(sun)}, ${sun.getFullYear()}`;
    }
    const fmtFull = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const raw = fmtFull.format(currentDate);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [mode, currentDate, monthName, year, locale]);

  // Tasks grouped by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(task => {
      const due = task.dueDate?.toDate?.();
      if (due) {
        const key = due.toDateString();
        if (!map[key]) map[key] = [];
        map[key].push(task);
      }
    });
    return map;
  }, [tasks]);

  // Calendar days for month view
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, today) });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({ date, isCurrentMonth: true, isToday: isSameDay(date, today) });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({ date, isCurrentMonth: false, isToday: isSameDay(date, today) });
    }
    return days;
  }, [year, month, today]);

  // Week days
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // DnD handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedTask(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateKey);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (draggedTask) {
      const newDate = new Date(date);
      newDate.setHours(12, 0, 0, 0);
      onDateChange(draggedTask.id, newDate);
    }
    setDraggedTask(null);
    setDragOverDate(null);
  };

  return (
    <div className="h-full flex flex-col px-6 py-4">
      {/* ═══ Navigation header ═══ */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] shadow-sm p-0.5">
            <button onClick={prev} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-150">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={next} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-150">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-[20px] font-bold text-[var(--text-primary)] leading-none tracking-tight">
            {title}
          </h2>

          <button
            onClick={goToday}
            className="h-8 text-[13px] font-semibold px-4 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] border border-[var(--border)] transition-all duration-200 shadow-sm"
          >
            {t('common.today')}
          </button>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-sm p-1 gap-0.5">
          {(['month', 'week', 'day'] as CalMode[]).map(m => {
            const isActive = mode === m;
            return (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}>
                {m === 'month' ? t('planner.month') : m === 'week' ? t('planner.week') : t('planner.day')}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ MONTH VIEW ═══════════════ */}
      {mode === 'month' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] shadow-card bg-[var(--bg-elevated)]">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-[var(--bg-tertiary)]/60">
            {weekdayNames.map((name, i) => (
              <div key={name} className={`
                text-center text-[11px] font-semibold uppercase tracking-[0.08em] py-3
                ${i < 6 ? 'border-r border-[var(--border)]/40' : ''}
                ${i === 5 || i === 6 ? 'text-[var(--text-muted)]/70' : 'text-[var(--text-muted)]'}
              `}>
                {name}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
            {calendarDays.map((day, i) => {
              const dateKey = day.date.toDateString();
              const dayTasks = tasksByDate[dateKey] || [];
              const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
              const isDropTarget = dragOverDate === dateKey;
              const row = Math.floor(i / 7);
              const col = i % 7;

              return (
                <div
                  key={i}
                  className={`
                    flex flex-col overflow-hidden transition-all duration-150
                    ${row < 5 ? 'border-b border-[var(--border)]/50' : ''}
                    ${col < 6 ? 'border-r border-[var(--border)]/50' : ''}
                    ${!day.isCurrentMonth
                      ? 'bg-[var(--bg-tertiary)]/30'
                      : isWeekend
                        ? 'bg-[var(--bg-secondary)]/40'
                        : 'bg-[var(--bg-base)]/60'
                    }
                    ${day.isToday ? '!bg-[var(--accent)]/6' : ''}
                    ${isDropTarget ? '!bg-[var(--accent)]/10 ring-2 ring-inset ring-[var(--accent)]/30' : ''}
                    hover:bg-[var(--accent)]/3
                  `}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day.date)}
                >
                  {/* Date header */}
                  <div className="flex items-center justify-between px-2 pt-2 pb-1">
                    <span className={`
                      text-[12px] font-semibold leading-none
                      ${day.isToday
                        ? 'w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--accent-text)] flex items-center justify-center shadow-sm'
                        : day.isCurrentMonth
                          ? 'text-[var(--text-primary)] px-0.5'
                          : 'text-[var(--text-muted)]/50 px-0.5'
                      }
                    `}>
                      {day.date.getDate()}
                    </span>
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-[var(--accent)] font-semibold bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded-md">
                        +{dayTasks.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="flex-1 overflow-hidden px-1.5 pb-1.5 space-y-1">
                    {dayTasks.slice(0, 3).map(task => (
                      <PlannerEvent
                        key={task.id}
                        task={task}
                        isSelected={selectedTask?.id === task.id}
                        onSelect={() => onSelect(task)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ WEEK VIEW ═══════════════ */}
      {mode === 'week' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] shadow-card bg-[var(--bg-elevated)]">
          <div className="grid grid-cols-7 flex-1 min-h-0">
            {weekDays.map((wd, i) => {
              const dateKey = wd.toDateString();
              const dayTasks = tasksByDate[dateKey] || [];
              const isToday = isSameDay(wd, today);
              const isWeekend = wd.getDay() === 0 || wd.getDay() === 6;
              const isDropTarget = dragOverDate === dateKey;

              return (
                <div
                  key={i}
                  className={`
                    flex flex-col
                    ${i < 6 ? 'border-r border-[var(--border)]/50' : ''}
                    ${isWeekend ? 'bg-[var(--bg-secondary)]/30' : ''}
                    ${isToday ? '!bg-[var(--accent)]/5' : ''}
                    ${isDropTarget ? '!bg-[var(--accent)]/10 ring-2 ring-inset ring-[var(--accent)]/30' : ''}
                  `}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, wd)}
                >
                  {/* Day header */}
                  <div className={`
                    text-center py-3 px-2 border-b border-[var(--border)]/50
                    ${isToday ? 'bg-[var(--accent)]/8' : 'bg-[var(--bg-tertiary)]/50'}
                  `}>
                    <span className={`
                      text-[11px] font-semibold uppercase tracking-wide block
                      ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}
                    `}>
                      {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(wd)}
                    </span>
                    <span className={`
                      text-[18px] font-bold leading-none mt-1 inline-flex items-center justify-center
                      ${isToday
                        ? 'w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                        : 'text-[var(--text-primary)]'
                      }
                    `}>
                      {wd.getDate()}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[200px]">
                    {dayTasks.map(task => (
                      <PlannerEvent
                        key={task.id}
                        task={task}
                        isSelected={selectedTask?.id === task.id}
                        onSelect={() => onSelect(task)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                    {dayTasks.length === 0 && (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-[11px] text-[var(--text-muted)]/30">&mdash;</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ DAY VIEW ═══════════════ */}
      {mode === 'day' && (() => {
        const dateKey = currentDate.toDateString();
        const dayTasks = tasksByDate[dateKey] || [];
        const isToday = isSameDay(currentDate, today);

        return (
          <div className="flex-1 rounded-2xl border border-[var(--border)] shadow-card bg-[var(--bg-elevated)] overflow-hidden flex flex-col">
            {/* Day header */}
            <div className={`
              flex items-center justify-center gap-4 py-6 border-b border-[var(--border)]/50
              ${isToday ? 'bg-[var(--accent)]/6' : 'bg-[var(--bg-tertiary)]/40'}
            `}>
              <span className={`
                text-[28px] font-bold leading-none flex items-center justify-center
                w-14 h-14 rounded-2xl shadow-sm
                ${isToday ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border)]'}
              `}>
                {currentDate.getDate()}
              </span>
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(currentDate).replace(/^./, c => c.toUpperCase())}
                </span>
                <span className="text-[13px] text-[var(--text-muted)]">
                  {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(currentDate).replace(/^./, c => c.toUpperCase())}
                </span>
              </div>
              {isToday && (
                <span className="text-[11px] px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-text)] font-semibold uppercase tracking-wide shadow-sm">
                  {t('common.today')}
                </span>
              )}
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto p-5">
              {dayTasks.length > 0 ? (
                <div className="space-y-2 max-w-2xl mx-auto">
                  {dayTasks.map(task => (
                    <DayViewCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTask?.id === task.id}
                      members={members}
                      onSelect={() => onSelect(task)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
                    <CalendarDays className="h-7 w-7 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[14px] font-medium">{t('planner.noTasksDay')}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
