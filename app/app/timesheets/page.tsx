'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getTimeEntriesByDateRange, createTimeEntry, deleteTimeEntry, getTasks } from '@/lib/db';
import TimesheetTable from '@/components/timesheets/timesheet-table';
import TimeEntryModal from '@/components/timesheets/time-entry-modal';
import { TimerFloating, useTimer } from '@/components/timesheets/timer-widget';
import { getWeekDates, minutesToDisplay, totalMinutes, formatDuration } from '@/components/timesheets/constants';
import type { TimeEntry } from '@/components/timesheets/constants';

export default function TimesheetsPage() {
  const { user, me, isAdmin, isManager, activeTeamId, allMembers } = useAuth();
  const { t } = useI18n();

  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  const timer = useTimer();

  const weekDays = getWeekDates(weekOffset);
  const startDate = weekDays[0].date;
  const endDate = weekDays[6].date;

  const canSeeAll = isAdmin || isManager;

  const loadData = useCallback(async () => {
    setLoading(true);
    const userId = canSeeAll ? (filterUserId || undefined) : user?.uid;
    const [entriesData, { items: tasksData }] = await Promise.all([
      getTimeEntriesByDateRange(startDate, endDate, userId),
      getTasks(activeTeamId === '__all__' ? undefined : activeTeamId),
    ]);
    setEntries(entriesData as TimeEntry[]);
    setTasks(tasksData);
    setLoading(false);
  }, [startDate, endDate, filterUserId, canSeeAll, user?.uid, activeTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (data: any) => {
    await createTimeEntry({
      ...data,
      userId: user?.uid || '',
      userName: me?.displayName || '',
      teamId: me?.teamId || '',
      createdBy: user?.uid || '',
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteTimeEntry(id);
    loadData();
  };

  const handleCellClick = (taskId: string, taskTitle: string, date: string) => {
    setModalDate(date);
    setShowModal(true);
  };

  const handleTimerStart = () => {
    // Open modal to select task, then start
    setShowModal(true);
  };

  const handleTimerStop = async () => {
    const elapsed = timer.stop();
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    if (hours > 0 || minutes > 0) {
      await createTimeEntry({
        taskId: '', // Will need to be from timer context
        taskTitle: timer.taskTitle,
        date: new Date().toISOString().split('T')[0],
        hours,
        minutes,
        notes: '',
        billable: false,
        userId: user?.uid || '',
        userName: me?.displayName || '',
        teamId: me?.teamId || '',
        createdBy: user?.uid || '',
      });
      loadData();
    }
  };

  // Week total
  const weekTotal = totalMinutes(entries);
  const weekDisplay = minutesToDisplay(weekTotal);

  // Format week label
  const weekStart = new Date(startDate);
  const weekLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="h-6 w-6 text-[var(--accent)]" />
            {t('timesheets.title')}
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-0.5">{t('timesheets.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {!timer.running && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTimerStart}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium shadow-md hover:opacity-90 transition"
            >
              <Play className="h-4 w-4" fill="white" /> {t('timesheets.startTimer')}
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setModalDate(''); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-md hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" /> {t('timesheets.logTime')}
          </motion.button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        {/* Week nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
            title={t('timesheets.prevWeek')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center min-w-[180px]">
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">{t('timesheets.weekOf')} {weekLabel}</p>
          </div>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
            title={t('timesheets.nextWeek')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition font-medium"
            >
              {t('timesheets.thisWeek')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* User filter (admin/manager only) */}
          {canSeeAll && (
            <select
              value={filterUserId}
              onChange={e => setFilterUserId(e.target.value)}
              className="h-8 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
            >
              <option value="">{t('timesheets.allMembers')}</option>
              {allMembers.filter(m => m.active !== false).map(m => (
                <option key={m.userId} value={m.userId}>{m.displayName}</option>
              ))}
            </select>
          )}

          {/* Week total */}
          <div className="px-4 py-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
            <span className="text-[12px] font-medium uppercase tracking-wider">{t('timesheets.totalWeek')}: </span>
            <span className="text-[14px] font-bold">{formatDuration(weekDisplay.hours, weekDisplay.minutes)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <TimesheetTable
          entries={entries}
          weekDays={weekDays}
          onDelete={handleDelete}
          onCellClick={handleCellClick}
        />
      )}

      {/* Entry modal */}
      <TimeEntryModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        tasks={tasks}
        defaultDate={modalDate || undefined}
      />

      {/* Timer widget */}
      <AnimatePresence>
        {timer.running && (
          <TimerFloating
            startedAt={timer.startedAt}
            taskTitle={timer.taskTitle}
            onStop={handleTimerStop}
            onDiscard={timer.discard}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
