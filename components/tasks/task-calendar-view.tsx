'use client';

import { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Task, CalendarMode, CALENDAR_MODES, getStatusConfig, getPriorityConfig } from './constants';

// =============================================
// PROPS
// =============================================
interface Props {
  tasks: Task[];
  members: any[];
  selectedTask: Task | null;
  calendarMode: CalendarMode;
  onSelect: (task: Task) => void;
  onDateChange: (taskId: string, newDate: Date) => void;
  onModeChange: (mode: CalendarMode) => void;
}

// =============================================
// HELPERS
// =============================================

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    return wd;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// =============================================
// CALENDAR EVENT CHIP (premium)
// =============================================
function CalendarEvent({
  task,
  isSelected,
  onSelect,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusCfg = getStatusConfig(task.status);
  const priorityCfg = getPriorityConfig(task.priority);
  const isDone = task.status === 'done';

  return (
    <button
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

// =============================================
// COMPONENT
// =============================================
export default function TaskCalendarView({
  tasks,
  members,
  selectedTask,
  calendarMode,
  onSelect,
  onDateChange,
  onModeChange,
}: Props) {
  const { t, lang } = useI18n();
  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  const [currentDate, setCurrentDate] = useState(new Date());
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

  // Calendar days (month view - 42 cells / 6 rows)
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

  // Week days for week view
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // Tasks indexed by date string
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const due = task.dueDate?.toDate?.();
      if (due) {
        const key = due.toDateString();
        if (!map[key]) map[key] = [];
        map[key].push(task);
      }
    });
    return map;
  }, [tasks]);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    if (calendarMode === 'month') setCurrentDate(new Date(year, month - 1, 1));
    else if (calendarMode === 'week') { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }
    else { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); }
  };
  const goNext = () => {
    if (calendarMode === 'month') setCurrentDate(new Date(year, month + 1, 1));
    else if (calendarMode === 'week') { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }
    else { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); }
  };

  // Navigation title
  const navigationTitle = useMemo(() => {
    if (calendarMode === 'month') return `${monthName} ${year}`;
    if (calendarMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      const fmtDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} \u2013 ${fmtDay.format(last)}, ${last.getFullYear()}`;
      }
      return `${fmtDay.format(first)} \u2013 ${fmtDay.format(last)}, ${last.getFullYear()}`;
    }
    const fmtFull = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const raw = fmtFull.format(currentDate);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [calendarMode, monthName, year, weekDays, currentDate, locale]);

  const modeLabel = (id: CalendarMode) => t(`calendarMode.${id}`);

  const formatWeekDayHeader = (date: Date) => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const dayName = fmt.format(date);
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${date.getDate()}`;
  };

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="h-full flex flex-col px-5 py-4 overflow-hidden">
      {/* ═══ Navigation Bar ═══ */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] shadow-sm p-0.5">
            <button onClick={goPrev} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-150">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={goNext} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-150">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-[20px] font-bold text-[var(--text-primary)] leading-none tracking-tight">
            {navigationTitle}
          </h2>

          <button
            onClick={goToday}
            className="h-8 text-[13px] font-semibold px-4 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] border border-[var(--border)] transition-all duration-200 shadow-sm"
          >
            {t('common.today')}
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-sm p-1 gap-0.5">
          {CALENDAR_MODES.map((mode) => {
            const isActive = calendarMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={`
                  relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold
                  transition-all duration-200
                  ${isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }
                `}
              >
                <mode.Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{modeLabel(mode.id)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Calendar Content ═══ */}
        {/* ═══════════════ MONTH VIEW ═══════════════ */}
        {calendarMode === 'month' && (
          <div
            className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] shadow-card bg-[var(--bg-elevated)]"
          >
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-[var(--bg-tertiary)]/60">
              {weekdayNames.map((name, i) => (
                <div
                  key={name}
                  className={`
                    text-center text-[11px] font-semibold uppercase tracking-[0.08em] py-3
                    ${i < 6 ? 'border-r border-[var(--border)]/40' : ''}
                    ${i === 5 || i === 6
                      ? 'text-[var(--text-muted)]/70'
                      : 'text-[var(--text-muted)]'
                    }
                  `}
                >
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
                const row = Math.floor(i / 7);
                const col = i % 7;

                return (
                  <div
                    key={i}
                    className={`
                      flex flex-col overflow-hidden transition-colors duration-100
                      ${row < 5 ? 'border-b border-[var(--border)]/50' : ''}
                      ${col < 6 ? 'border-r border-[var(--border)]/50' : ''}
                      ${!day.isCurrentMonth
                        ? 'bg-[var(--bg-tertiary)]/30'
                        : isWeekend
                          ? 'bg-[var(--bg-secondary)]/40'
                          : 'bg-[var(--bg-base)]/60'
                      }
                      ${day.isToday ? '!bg-[var(--accent)]/6' : ''}
                      hover:bg-[var(--accent)]/3
                    `}
                  >
                    {/* Date header */}
                    <div className="flex items-center justify-between px-2 pt-2 pb-1">
                      <span
                        className={`
                          text-[12px] font-semibold leading-none
                          ${day.isToday
                            ? 'w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--accent-text)] flex items-center justify-center shadow-sm'
                            : day.isCurrentMonth
                              ? 'text-[var(--text-primary)] px-0.5'
                              : 'text-[var(--text-muted)]/50 px-0.5'
                          }
                        `}
                      >
                        {day.date.getDate()}
                      </span>
                      {dayTasks.length > 3 && (
                        <span className="text-[10px] text-[var(--accent)] font-semibold bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded-md">
                          +{dayTasks.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Task events */}
                    <div className="flex-1 overflow-hidden px-1.5 pb-1.5 space-y-1">
                      {dayTasks.slice(0, 3).map((task) => (
                        <CalendarEvent
                          key={task.id}
                          task={task}
                          isSelected={selectedTask?.id === task.id}
                          onSelect={() => onSelect(task)}
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
        {calendarMode === 'week' && (
          <div
            className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] shadow-card bg-[var(--bg-elevated)]"
          >
            <div className="grid grid-cols-7 flex-1 min-h-0">
              {weekDays.map((day, i) => {
                const dateKey = day.toDateString();
                const dayTasks = tasksByDate[dateKey] || [];
                const isToday = isSameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={i}
                    className={`
                      flex flex-col
                      ${i < 6 ? 'border-r border-[var(--border)]/50' : ''}
                      ${isWeekend ? 'bg-[var(--bg-secondary)]/30' : ''}
                      ${isToday ? '!bg-[var(--accent)]/5' : ''}
                    `}
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
                        {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}
                      </span>
                      <span className={`
                        text-[18px] font-bold leading-none mt-1 inline-flex items-center justify-center
                        ${isToday
                          ? 'w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                          : 'text-[var(--text-primary)]'
                        }
                      `}>
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Tasks */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[200px]">
                      {dayTasks.map((task) => (
                        <CalendarEvent
                          key={task.id}
                          task={task}
                          isSelected={selectedTask?.id === task.id}
                          onSelect={() => onSelect(task)}
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
        {calendarMode === 'day' && (
          <div
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            {(() => {
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
                        {dayTasks.map((task) => {
                          const statusCfg = getStatusConfig(task.status);
                          const priorityCfg = getPriorityConfig(task.priority);
                          const isDone = task.status === 'done';
                          const assigneeNames = task.assignees?.slice(0, 2).map((uid: string) => {
                            const m = members.find((x: any) => x.id === uid);
                            return m?.displayName || m?.email || '';
                          }).filter(Boolean);

                          return (
                            <motion.button
                              key={task.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15 }}
                              onClick={() => onSelect(task)}
                              className={`
                                w-full text-left p-4 rounded-xl border transition-all duration-200
                                flex items-center gap-3
                                ${selectedTask?.id === task.id
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
                              <span
                                className="text-[11px] px-2.5 py-1 rounded-lg font-medium shrink-0"
                                style={{ backgroundColor: `${statusCfg.color}15`, color: statusCfg.color }}
                              >
                                {t(`status.${statusCfg.id}`)}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
                          <CalendarIcon className="w-7 h-7 text-[var(--text-muted)]" />
                        </div>
                        <p className="text-[14px] text-[var(--text-muted)] font-medium">
                          {t('planner.noTasksDay')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
    </div>
  );
}
