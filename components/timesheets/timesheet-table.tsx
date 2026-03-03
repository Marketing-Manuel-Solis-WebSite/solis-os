'use client';
import { useI18n } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';
import type { TimeEntry, WeekDay } from './constants';
import { formatDuration, totalMinutes, minutesToDisplay } from './constants';

interface Props {
  entries: TimeEntry[];
  weekDays: WeekDay[];
  onDelete: (id: string) => void;
  onCellClick: (taskId: string, taskTitle: string, date: string) => void;
}

export default function TimesheetTable({ entries, weekDays, onDelete, onCellClick }: Props) {
  const { t } = useI18n();

  // Group entries by taskId
  const taskMap = new Map<string, { title: string; entries: TimeEntry[] }>();
  entries.forEach(e => {
    if (!taskMap.has(e.taskId)) {
      taskMap.set(e.taskId, { title: e.taskTitle, entries: [] });
    }
    taskMap.get(e.taskId)!.entries.push(e);
  });

  const tasks = Array.from(taskMap.entries());

  // Column totals
  const colTotals = weekDays.map(day => {
    const dayEntries = entries.filter(e => e.date === day.date);
    return totalMinutes(dayEntries);
  });
  const grandTotal = colTotals.reduce((s, v) => s + v, 0);

  return (
    <div className="overflow-x-auto rounded-xl bg-[var(--bg-elevated)] ring-1 ring-[var(--border-subtle)]">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="text-left px-4 py-3 text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[200px]">
              {t('timesheets.task')}
            </th>
            {weekDays.map(day => (
              <th
                key={day.date}
                className={`text-center px-2 py-3 text-[12px] font-semibold uppercase tracking-wider w-[80px] ${
                  day.isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`}
              >
                <div>{t(day.dayName)}</div>
                <div className={`text-[14px] mt-0.5 ${day.isToday ? 'font-bold' : 'font-medium'}`}>{day.dayNum}</div>
              </th>
            ))}
            <th className="text-center px-4 py-3 text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[80px]">
              {t('timesheets.total')}
            </th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-center py-12">
                <p className="text-[13px] text-[var(--text-muted)]">{t('timesheets.noEntries')}</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{t('timesheets.noEntriesDesc')}</p>
              </td>
            </tr>
          ) : (
            tasks.map(([taskId, { title, entries: taskEntries }]) => {
              const rowTotal = totalMinutes(taskEntries);
              const display = minutesToDisplay(rowTotal);
              return (
                <tr key={taskId} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]/50 transition group">
                  <td className="px-4 py-2.5">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate max-w-[180px]">{title}</p>
                  </td>
                  {weekDays.map(day => {
                    const dayEntry = taskEntries.find(e => e.date === day.date);
                    const mins = dayEntry ? (dayEntry.hours || 0) * 60 + (dayEntry.minutes || 0) : 0;
                    return (
                      <td
                        key={day.date}
                        className={`text-center px-2 py-2.5 cursor-pointer transition ${
                          day.isToday ? 'bg-[var(--accent)]/5' : ''
                        }`}
                        onClick={() => onCellClick(taskId, title, day.date)}
                      >
                        {mins > 0 ? (
                          <span className="text-[13px] font-medium text-[var(--text-primary)]">
                            {formatDuration(Math.floor(mins / 60), mins % 60)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-[var(--text-muted)]/30 group-hover:text-[var(--text-muted)] transition">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-4 py-2.5">
                    <span className="text-[13px] font-semibold text-[var(--accent)]">
                      {formatDuration(display.hours, display.minutes)}
                    </span>
                  </td>
                  <td className="px-2">
                    {taskEntries.length > 0 && (
                      <button
                        onClick={() => taskEntries.forEach(e => onDelete(e.id))}
                        className="p-1 rounded-md text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
          {/* Totals row */}
          {tasks.length > 0 && (
            <tr className="bg-[var(--bg-base)]">
              <td className="px-4 py-3 text-[13px] font-semibold text-[var(--text-primary)]">{t('timesheets.total')}</td>
              {colTotals.map((mins, i) => {
                const d = minutesToDisplay(mins);
                return (
                  <td key={i} className={`text-center px-2 py-3 ${weekDays[i].isToday ? 'bg-[var(--accent)]/5' : ''}`}>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {mins > 0 ? formatDuration(d.hours, d.minutes) : '—'}
                    </span>
                  </td>
                );
              })}
              <td className="text-center px-4 py-3">
                <span className="text-[14px] font-bold text-[var(--accent)]">
                  {formatDuration(minutesToDisplay(grandTotal).hours, minutesToDisplay(grandTotal).minutes)}
                </span>
              </td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
