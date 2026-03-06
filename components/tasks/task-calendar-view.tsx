'use client';

import { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, CalendarMode, CALENDAR_MODES } from './constants';
import TaskCard from './task-card';

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

/** Returns an array of 7 Date objects for the Monday-based week containing `date`. */
function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  // Shift so Monday = 0, Sunday = 6
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    return wd;
  });
}

/** Checks if two dates represent the same calendar day. */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
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

  // ─── Locale-aware weekday names (Monday-based) ──────────────
  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // Jan 6, 2020 is a Monday
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2020, 0, 6 + i)));
  }, [locale]);

  // ─── Month name ─────────────────────────────────────────────
  const monthName = useMemo(() => {
    const raw = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [locale, year, month]);

  // ─── Calendar days (month view - 42 cells / 6 rows) ────────
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-based start offset (0=Mon, 6=Sun)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, today) });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
      });
    }

    // Next month padding (fill to 42 = 6 rows)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({ date, isCurrentMonth: false, isToday: isSameDay(date, today) });
    }

    return days;
  }, [year, month, today]);

  // ─── Week days for week view ────────────────────────────────
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // ─── Tasks indexed by date string ──────────────────────────
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

  // ─── Navigation handlers ───────────────────────────────────
  const goToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    if (calendarMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (calendarMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const goNext = () => {
    if (calendarMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (calendarMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  // ─── Navigation title ──────────────────────────────────────
  const navigationTitle = useMemo(() => {
    if (calendarMode === 'month') {
      return `${monthName} ${year}`;
    }
    if (calendarMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      const fmtDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} - ${fmtDay.format(last)}, ${last.getFullYear()}`;
      }
      return `${fmtDay.format(first)} - ${fmtDay.format(last)}, ${last.getFullYear()}`;
    }
    // day
    const fmtFull = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const raw = fmtFull.format(currentDate);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [calendarMode, monthName, year, weekDays, currentDate, locale]);

  // ─── Mode label lookup ─────────────────────────────────────
  const modeLabel = (id: CalendarMode) => {
    return t(`planner.${id}`);
  };

  // ─── Day header for week view ("Lun 15" format) ────────────
  const formatWeekDayHeader = (date: Date) => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const dayName = fmt.format(date);
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${date.getDate()}`;
  };

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="h-full flex flex-col px-7 py-4">
      {/* ─── Navigation Bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        {/* Left: Title + Today button */}
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-bold text-[var(--text-primary)] leading-none">
            {navigationTitle}
          </h2>
          <button
            onClick={goToday}
            className="h-8 text-[13px] font-medium px-3 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all duration-200"
          >
            {t('common.today')}
          </button>
        </div>

        {/* Right: Arrows + Mode selector */}
        <div className="flex items-center gap-3">
          {/* Mode selector */}
          <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] shadow-sm p-1">
            {CALENDAR_MODES.map((mode) => {
              const isActive = calendarMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => onModeChange(mode.id)}
                  className={`
                    relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="calendar-mode-indicator"
                      className="absolute inset-0 bg-[var(--accent)]/10 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <mode.Icon className="h-3.5 w-3.5 relative z-10" />
                  <span className="relative z-10 hidden sm:inline">{modeLabel(mode.id)}</span>
                </button>
              );
            })}
          </div>

          {/* Prev/Next arrows */}
          <div className="flex gap-0.5">
            <button
              onClick={goPrev}
              className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-150"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goNext}
              className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-150"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Calendar Content (animated transitions) ────────── */}
      <AnimatePresence mode="wait">
        {calendarMode === 'month' && (
          <motion.div
            key="month"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {weekdayNames.map((name) => (
                <div
                  key={name}
                  className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] py-2.5"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 flex-1 rounded-2xl shadow-md overflow-hidden">
              {calendarDays.map((day, i) => {
                const dateKey = day.date.toDateString();
                const dayTasks = tasksByDate[dateKey] || [];

                return (
                  <div
                    key={i}
                    className={`
                      min-h-[100px] border-b border-r border-[var(--border-subtle)]/50
                      p-2 transition-all duration-200
                      ${!day.isCurrentMonth ? 'opacity-40' : ''}
                      ${day.isToday ? 'bg-[var(--accent)]/5' : ''}
                    `}
                  >
                    {/* Date number */}
                    <div className="flex items-center mb-1">
                      <span
                        className={`
                          text-[13px] font-semibold flex items-center justify-center
                          w-7 h-7 rounded-full leading-none
                          ${day.isToday
                            ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                            : day.isCurrentMonth
                              ? 'text-[var(--text-secondary)]'
                              : 'text-[var(--text-muted)]'
                          }
                        `}
                      >
                        {day.date.getDate()}
                      </span>
                    </div>

                    {/* Tasks (max 3) */}
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          members={members}
                          teams={[]}
                          isSelected={selectedTask?.id === task.id}
                          compact
                          onSelect={() => onSelect(task)}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[11px] text-[var(--text-muted)] px-2 py-1 rounded-md font-medium">
                          +{dayTasks.length - 3} {lang === 'es' ? 'mas' : 'more'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {calendarMode === 'week' && (
          <motion.div
            key="week"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Week grid */}
            <div className="grid grid-cols-7 flex-1 rounded-xl shadow-card overflow-hidden">
              {weekDays.map((day, i) => {
                const dateKey = day.toDateString();
                const dayTasks = tasksByDate[dateKey] || [];
                const isToday = isSameDay(day, today);

                return (
                  <div
                    key={i}
                    className={`
                      flex flex-col border-r border-[var(--border-subtle)]/30
                      ${i === 6 ? 'border-r-0' : ''}
                      ${isToday ? 'bg-[var(--accent)]/5' : ''}
                    `}
                  >
                    {/* Day header */}
                    <div
                      className={`
                        text-center py-3.5 border-b border-[var(--border-subtle)]/50
                        ${isToday ? 'bg-[var(--accent)]/8' : 'bg-[var(--bg-elevated)]/50'}
                      `}
                    >
                      <span
                        className={`
                          text-[13px] font-semibold
                          ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}
                        `}
                      >
                        {formatWeekDayHeader(day)}
                      </span>
                      {isToday && (
                        <div className="mx-auto mt-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                      )}
                    </div>

                    {/* Tasks (scrollable, no limit) */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[320px]">
                      {dayTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          members={members}
                          teams={[]}
                          isSelected={selectedTask?.id === task.id}
                          compact
                          onSelect={() => onSelect(task)}
                        />
                      ))}
                      {dayTasks.length === 0 && (
                        <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity duration-200">
                          <span className="text-[11px] text-[var(--text-muted)]">--</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {calendarMode === 'day' && (
          <motion.div
            key="day"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0"
          >
            {(() => {
              const dateKey = currentDate.toDateString();
              const dayTasks = tasksByDate[dateKey] || [];
              const isToday = isSameDay(currentDate, today);

              return (
                <div className="flex-1 rounded-xl shadow-card overflow-hidden flex flex-col">
                  {/* Day header banner */}
                  <div
                    className={`
                      flex items-center justify-center gap-3 py-5 border-b border-[var(--border-subtle)]/50
                      ${isToday ? 'bg-[var(--accent)]/5' : 'bg-[var(--bg-elevated)]/50'}
                    `}
                  >
                    <span
                      className={`
                        text-[30px] font-bold leading-none flex items-center justify-center
                        w-14 h-14 rounded-2xl
                        ${isToday
                          ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                          : 'text-[var(--text-primary)]'
                        }
                      `}
                    >
                      {currentDate.getDate()}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">
                        {new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(currentDate).replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-[12px] text-[var(--text-muted)] leading-tight">
                        {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(currentDate).replace(/^./, (c) => c.toUpperCase())}
                      </span>
                    </div>
                    {isToday && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--accent-text)] font-semibold uppercase tracking-wide">
                        {t('common.today')}
                      </span>
                    )}
                  </div>

                  {/* Tasks list */}
                  <div className="flex-1 overflow-y-auto p-5">
                    {dayTasks.length > 0 ? (
                      <div className="space-y-3 max-w-3xl mx-auto">
                        {dayTasks.map((task) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <TaskCard
                              task={task}
                              members={members}
                              teams={[]}
                              isSelected={selectedTask?.id === task.id}
                              onSelect={() => onSelect(task)}
                            />
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center">
                          <svg
                            className="w-7 h-7 text-[var(--text-muted)]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                            />
                          </svg>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
