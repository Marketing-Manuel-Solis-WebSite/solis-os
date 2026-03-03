'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Task, PRIORITIES } from '@/components/tasks/constants';
import TaskCard from '@/components/tasks/task-card';
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

function getDow(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
}

export default function PlannerCalendar({ tasks, members, teams, selectedTask, onSelect, onDateChange }: Props) {
  const { t, lang } = useI18n();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalMode>('month');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const DIAS = lang === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const DIAS_FULL = lang === 'en'
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const MESES = lang === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const todayStr = today.toDateString();

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

  // Title
  const title = useMemo(() => {
    if (mode === 'month') return `${MESES[month]} ${year}`;
    if (mode === 'week') {
      const weekDays = getWeekDays(currentDate);
      const mon = weekDays[0];
      const sun = weekDays[6];
      if (mon.getMonth() === sun.getMonth()) {
        return `${mon.getDate()} – ${sun.getDate()} ${MESES[mon.getMonth()]} ${mon.getFullYear()}`;
      }
      return `${mon.getDate()} ${MESES[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MESES[sun.getMonth()].slice(0, 3)} ${sun.getFullYear()}`;
    }
    return lang === 'en'
      ? `${DIAS_FULL[getDow(currentDate)]}, ${MESES[month]} ${currentDate.getDate()}, ${year}`
      : `${DIAS_FULL[getDow(currentDate)]} ${currentDate.getDate()} de ${MESES[month]} ${year}`;
  }, [mode, currentDate, month, year, MESES, DIAS_FULL, lang]);

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
      days.push({ date: d, isCurrentMonth: false, isToday: d.toDateString() === todayStr });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({ date, isCurrentMonth: true, isToday: date.toDateString() === todayStr });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({ date, isCurrentMonth: false, isToday: date.toDateString() === todayStr });
    }
    return days;
  }, [year, month, todayStr]);

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

  // Render a cell (shared between month and week)
  const renderCell = (date: Date, isCurrentMonth: boolean, isToday: boolean, maxTasks: number) => {
    const dateKey = date.toDateString();
    const dayTasks = tasksByDate[dateKey] || [];
    const isDropTarget = dragOverDate === dateKey;

    return (
      <div
        key={dateKey}
        className={`border-b border-r border-[var(--border-subtle)]/50 p-1.5 transition-all duration-200 ${
          !isCurrentMonth ? 'bg-[var(--bg-elevated)]/30 opacity-40' : ''
        } ${isToday ? 'bg-[var(--accent)]/5' : ''} ${
          isDropTarget ? 'ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/5' : ''
        }`}
        onDragOver={(e) => handleDragOver(e, dateKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, date)}
      >
        {/* Date number */}
        <div className={`text-[13px] font-semibold mb-1 flex items-center justify-center w-6 h-6 rounded-full ${
          isToday
            ? 'bg-[var(--accent)] text-[var(--accent-text)]'
            : isCurrentMonth
              ? 'text-[var(--text-secondary)]'
              : 'text-[var(--text-muted)]'
        }`}>
          {date.getDate()}
        </div>

        {/* Tasks */}
        <div className="space-y-0.5">
          {dayTasks.slice(0, maxTasks).map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task)}
              onDragEnd={handleDragEnd}
            >
              <TaskCard
                task={task}
                members={members}
                teams={teams}
                isSelected={selectedTask?.id === task.id}
                compact
                onSelect={() => onSelect(task)}
              />
            </div>
          ))}
          {dayTasks.length > maxTasks && (
            <div className="text-[9px] text-[var(--text-muted)] px-1">
              +{dayTasks.length - maxTasks} {t('common.more')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col px-6 py-3">
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
          <button onClick={goToday}
            className="text-[13px] px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all duration-200">
            {t('common.today')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode switcher */}
          <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
            {(['month', 'week', 'day'] as CalMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-sm transition ${
                  mode === m
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}>
                {m === 'month' ? t('planner.month') : m === 'week' ? t('planner.week') : t('planner.day')}
              </button>
            ))}
          </div>
          {/* Prev/Next */}
          <button onClick={prev} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={next} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {mode === 'month' && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {DIAS.map(dia => (
              <div key={dia} className="text-center text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)] py-2">
                {dia}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 shadow-card rounded-xl overflow-hidden">
            {calendarDays.map((day) => renderCell(day.date, day.isCurrentMonth, day.isToday, 3))}
          </div>
        </>
      )}

      {/* WEEK VIEW */}
      {mode === 'week' && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((wd, i) => (
              <div key={i} className={`text-center py-2 ${wd.toDateString() === todayStr ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                <div className="text-[12px] font-semibold uppercase tracking-wider">{DIAS[i]}</div>
                <div className={`text-lg font-bold mt-0.5 ${
                  wd.toDateString() === todayStr ? 'w-8 h-8 mx-auto rounded-full bg-[var(--accent)] text-[var(--accent-text)] flex items-center justify-center' : ''
                }`}>
                  {wd.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 shadow-card rounded-xl overflow-hidden">
            {weekDays.map((wd) => {
              const dateKey = wd.toDateString();
              const dayTasks = tasksByDate[dateKey] || [];
              const isToday = dateKey === todayStr;
              const isDropTarget = dragOverDate === dateKey;
              return (
                <div
                  key={dateKey}
                  className={`border-r border-[var(--border-subtle)]/50 p-2 overflow-y-auto transition-all ${
                    isToday ? 'bg-[var(--accent)]/5' : ''
                  } ${isDropTarget ? 'ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/5' : ''}`}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, wd)}
                >
                  <div className="space-y-1.5">
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                      >
                        <TaskCard
                          task={task}
                          members={members}
                          teams={teams}
                          isSelected={selectedTask?.id === task.id}
                          compact
                          onSelect={() => onSelect(task)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* DAY VIEW */}
      {mode === 'day' && (() => {
        const dateKey = currentDate.toDateString();
        const dayTasks = tasksByDate[dateKey] || [];
        return (
          <div className="flex-1 overflow-y-auto">
            {dayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <CalendarDays className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-base">{t('planner.noTasksDay')}</p>
              </div>
            ) : (
              <div className="space-y-2 max-w-2xl">
                {dayTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    members={members}
                    teams={teams}
                    isSelected={selectedTask?.id === task.id}
                    onSelect={() => onSelect(task)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

