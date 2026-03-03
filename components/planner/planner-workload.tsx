'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Users, Clock, AlertTriangle } from 'lucide-react';
import { Task, PRIORITIES, STATUSES } from '@/components/tasks/constants';
import { useI18n } from '@/lib/i18n';

interface Props {
  tasks: Task[];
  members: any[];
  selectedTask: Task | null;
  onSelect: (task: Task) => void;
}

type Period = 'week' | 'month';
const CAPACITY_HOURS_PER_DAY = 8;

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getPeriodRange(date: Date, period: Period): { start: Date; end: Date } {
  if (period === 'week') {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatPeriodLabel(date: Date, period: Period, meses: string[]): string {
  if (period === 'week') {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.getDate()} – ${sunday.getDate()} ${meses[sunday.getMonth()]} ${sunday.getFullYear()}`;
  }
  return `${meses[date.getMonth()]} ${date.getFullYear()}`;
}

interface MemberWorkload {
  member: any;
  tasks: Task[];
  totalHours: number;
  capacityHours: number;
  percentage: number;
  status: 'underload' | 'optimal' | 'overload';
  tasksWithoutEstimate: number;
}

export default function PlannerWorkload({ tasks, members, selectedTask, onSelect }: Props) {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const MESES = lang === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const { start: periodStart, end: periodEnd } = getPeriodRange(currentDate, period);
  const capacityHours = period === 'week'
    ? CAPACITY_HOURS_PER_DAY * 5   // 40h
    : CAPACITY_HOURS_PER_DAY * 22;  // ~176h

  // Navigation
  const prev = () => {
    if (period === 'week') setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const next = () => {
    if (period === 'week') setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  // Aggregate workload per member
  const workloadData: MemberWorkload[] = useMemo(() => {
    return members.map(member => {
      const memberTasks = tasks.filter(t => {
        if (!t.assignees?.includes(member.id)) return false;
        if (t.status === 'done') return false;
        const due = t.dueDate?.toDate?.();
        const start = t.startDate?.toDate?.();
        const taskDate = due || start;
        if (!taskDate) return false;
        return taskDate >= periodStart && taskDate <= periodEnd;
      });

      const totalMinutes = memberTasks.reduce((sum, t) => sum + (t.timeEstimate || 0), 0);
      const totalHours = totalMinutes / 60;
      const percentage = capacityHours > 0 ? (totalHours / capacityHours) * 100 : 0;
      const tasksWithoutEstimate = memberTasks.filter(t => !t.timeEstimate).length;

      const status: 'underload' | 'optimal' | 'overload' =
        percentage > 100 ? 'overload' :
        percentage > 70 ? 'optimal' :
        'underload';

      return { member, tasks: memberTasks, totalHours, capacityHours, percentage, status, tasksWithoutEstimate };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [tasks, members, periodStart, periodEnd, capacityHours]);

  // Summary stats
  const totalAssigned = workloadData.reduce((s, w) => s + w.totalHours, 0);
  const totalCapacity = workloadData.length * capacityHours;
  const overloadCount = workloadData.filter(w => w.status === 'overload').length;

  return (
    <div className="h-full flex flex-col px-6 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('planner.workloadTitle')}</h2>
          <span className="text-sm text-[var(--text-muted)]">{formatPeriodLabel(currentDate, period, MESES)}</span>
          <button onClick={goToday}
            className="text-[13px] px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all duration-200">
            {t('common.today')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
            {(['week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm transition ${
                  period === p
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}>
                {p === 'week' ? t('planner.week') : t('planner.month')}
              </button>
            ))}
          </div>
          <button onClick={prev} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={next} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-[var(--bg-elevated)] shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{t('planner.totalAssigned')}</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{totalAssigned.toFixed(0)}h</p>
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-elevated)] shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-[var(--info)]" />
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{t('planner.capacity')}</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCapacity.toFixed(0)}h</p>
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-elevated)] shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-[var(--error)]" />
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{t('planner.overloaded')}</p>
          </div>
          <p className={`text-2xl font-bold ${overloadCount > 0 ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>{overloadCount}</p>
        </div>
      </div>

      {/* Member rows */}
      {workloadData.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-[var(--text-muted)]">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-base">{t('planner.noMembers')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {workloadData.map(({ member, tasks: memberTasks, totalHours, capacityHours: cap, percentage, status, tasksWithoutEstimate }) => {
            const isExpanded = expandedMember === member.id;
            return (
              <div key={member.id} className="rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
                {/* Main row */}
                <div className="p-4 cursor-pointer hover:bg-[var(--bg-hover)]/50 transition"
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                  <div className="flex items-center gap-3 mb-2">
                    {/* Avatar */}
                    {member.photoURL ? (
                      <img src={member.photoURL} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                        {member.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{member.displayName || member.email}</p>
                      <p className="text-[12px] text-[var(--text-muted)]">{member.title || member.role} · {t('planner.tasks', { n: memberTasks.length })}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        status === 'overload' ? 'text-[var(--error)]' :
                        status === 'optimal' ? 'text-[var(--success)]' :
                        'text-[var(--text-muted)]'
                      }`}>
                        {totalHours.toFixed(1)}h / {cap}h
                      </span>
                      {status === 'overload' && (
                        <span className="block text-[9px] px-2 py-0.5 rounded-full bg-[var(--error-bg)] text-[var(--error)] font-bold uppercase mt-0.5">
                          {t('planner.overloadBadge')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: status === 'overload' ? 'var(--error)' :
                                         status === 'optimal' ? 'var(--success)' : 'var(--accent)',
                      }}
                    />
                  </div>
                  {percentage > 100 && (
                    <div className="h-0.5 rounded-full bg-[var(--error)] mt-0.5"
                      style={{ width: `${Math.min((percentage - 100), 100)}%` }} />
                  )}

                  {/* Task pills preview */}
                  {!isExpanded && memberTasks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {memberTasks.slice(0, 4).map(tk => {
                        const pri = PRIORITIES.find(p => p.id === tk.priority);
                        return (
                          <span key={tk.id}
                            className="px-2 py-0.5 rounded-md text-[11px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] truncate max-w-[180px]"
                            style={{ borderLeft: `2px solid ${pri?.color || '#64748B'}` }}>
                            {tk.title}
                          </span>
                        );
                      })}
                      {memberTasks.length > 4 && (
                        <span className="text-[11px] text-[var(--text-muted)] px-1">+{memberTasks.length - 4} {t('common.more')}</span>
                      )}
                    </div>
                  )}

                  {tasksWithoutEstimate > 0 && (
                    <p className="text-[11px] text-[var(--warning)] mt-1">
                      {t('planner.tasksNoEstimate', { n: tasksWithoutEstimate })}
                    </p>
                  )}
                </div>

                {/* Expanded task list */}
                {isExpanded && memberTasks.length > 0 && (
                  <div className="border-t border-[var(--border-subtle)]/50 px-4 py-2 space-y-1">
                    {memberTasks.map(tk => {
                      const pri = PRIORITIES.find(p => p.id === tk.priority);
                      const st = STATUSES.find(s => s.id === tk.status);
                      const hours = tk.timeEstimate ? (tk.timeEstimate / 60).toFixed(1) : null;
                      const due = tk.dueDate?.toDate?.();
                      const isSelected = selectedTask?.id === tk.id;
                      return (
                        <div key={tk.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition hover:bg-[var(--bg-hover)] ${
                            isSelected ? 'bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/20' : ''
                          }`}
                          onClick={(e) => { e.stopPropagation(); onSelect(tk); }}>
                          <span className="text-[11px]">{pri?.icon}</span>
                          {st && <st.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: st.color }} />}
                          <span className={`text-sm flex-1 truncate ${
                            tk.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                          }`}>{tk.title}</span>
                          {hours ? (
                            <span className="text-[12px] text-[var(--text-muted)] shrink-0">{hours}h</span>
                          ) : (
                            <span className="text-[10px] text-[var(--warning)] shrink-0">{t('planner.noEstimate')}</span>
                          )}
                          {due && (
                            <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                              {due.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
