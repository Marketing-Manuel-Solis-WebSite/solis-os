'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from './constants';
import TaskCard from './task-card';

interface Props {
  tasks: Task[];
  members: any[];
  selectedTask: Task | null;
  onSelect: (task: Task) => void;
  onDateChange: (taskId: string, newDate: Date) => void;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function TaskCalendarView({ tasks, members, selectedTask, onSelect, onDateChange }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-based start (0=Mon, 6=Sun)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false, isToday: false });
    }

    // Current month
    const today = new Date();
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
      });
    }

    // Next month padding (fill to 42 = 6 rows)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false, isToday: false });
    }

    return days;
  }, [year, month]);

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

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="h-full flex flex-col px-6 py-3">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {MESES[month]} {year}
          </h2>
          <button onClick={goToday}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[#D4A843] hover:border-[#D4A843]/30 transition">
            Hoy
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS.map(dia => (
          <div key={dia} className="text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] py-2">
            {dia}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 border border-[var(--border-subtle)] rounded-xl overflow-hidden">
        {calendarDays.map((day, i) => {
          const dateKey = day.date.toDateString();
          const dayTasks = tasksByDate[dateKey] || [];

          return (
            <div
              key={i}
              className={`min-h-[80px] border-b border-r border-[var(--border-subtle)] p-1.5 transition ${
                !day.isCurrentMonth ? 'bg-[var(--bg-elevated)]/30 opacity-40' : ''
              } ${day.isToday ? 'bg-[#D4A843]/5' : ''}`}
            >
              {/* Date number */}
              <div className={`text-[11px] font-semibold mb-1 flex items-center justify-center w-6 h-6 rounded-full ${
                day.isToday
                  ? 'bg-[#D4A843] text-[#06080F]'
                  : day.isCurrentMonth
                    ? 'text-[var(--text-secondary)]'
                    : 'text-[var(--text-muted)]'
              }`}>
                {day.date.getDate()}
              </div>

              {/* Tasks */}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => (
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
                  <div className="text-[9px] text-[var(--text-muted)] px-1">
                    +{dayTasks.length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
