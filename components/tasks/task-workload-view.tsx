'use client';

// ============================================================
// Task Workload View — Shows task distribution & capacity per
// team member. Adapts the planner-workload pattern for the
// task view registry system.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { Task, TaskGroup, PRIORITIES, STATUSES } from './constants';
import { Users, Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

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

interface MemberWorkload {
  member: any;
  tasks: Task[];
  totalHours: number;
  capacityHours: number;
  percentage: number;
  status: 'underload' | 'optimal' | 'overload';
  tasksWithoutEstimate: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
}

const CAPACITY_HOURS_WEEK = 40;

// ─── Component ──────────────────────────────────────────
export default function TaskWorkloadView({
  groups, members, selectedTask, onSelect,
}: Props) {
  const { t, lang } = useI18n();
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'workload' | 'name' | 'tasks'>('workload');

  const allTasks = useMemo(() => groups.flatMap(g => g.tasks), [groups]);

  // Non-done tasks only for workload
  const activeTasks = useMemo(() => allTasks.filter(t => t.status !== 'done'), [allTasks]);

  // Aggregate workload per member
  const workloadData: MemberWorkload[] = useMemo(() => {
    const data = members.map(member => {
      const memberTasks = activeTasks.filter(t => t.assignees?.includes(member.id));

      const totalMinutes = memberTasks.reduce((sum, t) => sum + (t.timeEstimate || 0), 0);
      const totalHours = totalMinutes / 60;
      const percentage = CAPACITY_HOURS_WEEK > 0 ? (totalHours / CAPACITY_HOURS_WEEK) * 100 : 0;
      const tasksWithoutEstimate = memberTasks.filter(t => !t.timeEstimate).length;

      const status: 'underload' | 'optimal' | 'overload' =
        percentage > 100 ? 'overload' :
        percentage > 70 ? 'optimal' :
        'underload';

      // Priority & status breakdown
      const byPriority: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      for (const tk of memberTasks) {
        byPriority[tk.priority] = (byPriority[tk.priority] || 0) + 1;
        byStatus[tk.status] = (byStatus[tk.status] || 0) + 1;
      }

      return {
        member, tasks: memberTasks, totalHours,
        capacityHours: CAPACITY_HOURS_WEEK, percentage, status,
        tasksWithoutEstimate, byPriority, byStatus,
      };
    });

    // Sort
    if (sortBy === 'workload') data.sort((a, b) => b.percentage - a.percentage);
    else if (sortBy === 'name') data.sort((a, b) => (a.member.displayName || '').localeCompare(b.member.displayName || ''));
    else data.sort((a, b) => b.tasks.length - a.tasks.length);

    return data;
  }, [activeTasks, members, sortBy]);

  // Unassigned tasks
  const unassigned = useMemo(() => activeTasks.filter(t => !t.assignees?.length), [activeTasks]);

  // Summary stats
  const totalAssigned = workloadData.reduce((s, w) => s + w.totalHours, 0);
  const totalCapacity = workloadData.length * CAPACITY_HOURS_WEEK;
  const overloadCount = workloadData.filter(w => w.status === 'overload').length;

  const statusBarColor = (status: string) =>
    status === 'overload' ? 'var(--error)' :
    status === 'optimal' ? 'var(--success)' : 'var(--accent)';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] shrink-0">
        <div className="flex items-center gap-4">
          {/* Summary pills */}
          <div className="flex items-center gap-1.5 text-[12px]">
            <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="text-[var(--text-muted)]">
              {totalAssigned.toFixed(0)}h / {totalCapacity}h
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px]">
            <Users className="h-3.5 w-3.5 text-[var(--info)]" />
            <span className="text-[var(--text-muted)]">
              {workloadData.length} {lang === 'es' ? 'miembros' : 'members'}
            </span>
          </div>
          {overloadCount > 0 && (
            <div className="flex items-center gap-1.5 text-[12px]">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--error)]" />
              <span className="text-[var(--error)] font-medium">
                {overloadCount} {lang === 'es' ? 'sobrecargados' : 'overloaded'}
              </span>
            </div>
          )}
          {unassigned.length > 0 && (
            <span className="text-[12px] text-[var(--warning)]">
              {unassigned.length} {lang === 'es' ? 'sin asignar' : 'unassigned'}
            </span>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
          {(['workload', 'tasks', 'name'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1 text-[12px] font-medium transition ${
                sortBy === s
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}>
              {s === 'workload' ? (lang === 'es' ? 'Carga' : 'Load')
                : s === 'tasks' ? (lang === 'es' ? 'Tareas' : 'Tasks')
                : (lang === 'es' ? 'Nombre' : 'Name')}
            </button>
          ))}
        </div>
      </div>

      {/* Member rows */}
      {workloadData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{lang === 'es' ? 'No hay miembros del equipo' : 'No team members'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {workloadData.map(({ member, tasks: memberTasks, totalHours, percentage, status, tasksWithoutEstimate, byPriority }) => {
            const isExpanded = expandedMember === member.id;
            return (
              <div key={member.id} className="rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
                {/* Main row */}
                <div className="p-3 cursor-pointer hover:bg-[var(--bg-hover)]/50 transition"
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                  <div className="flex items-center gap-3 mb-2">
                    {/* Expand icon */}
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                    }
                    {/* Avatar */}
                    {member.photoURL ? (
                      <img src={member.photoURL} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--accent)] shrink-0">
                        {member.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{member.displayName || member.email}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {memberTasks.length} {lang === 'es' ? 'tareas' : 'tasks'}
                        {tasksWithoutEstimate > 0 && (
                          <span className="text-[var(--warning)] ml-1">
                            ({tasksWithoutEstimate} {lang === 'es' ? 'sin estimar' : 'unestimated'})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[13px] font-bold ${
                        status === 'overload' ? 'text-[var(--error)]' :
                        status === 'optimal' ? 'text-[var(--success)]' :
                        'text-[var(--text-muted)]'
                      }`}>
                        {totalHours.toFixed(1)}h / {CAPACITY_HOURS_WEEK}h
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: statusBarColor(status),
                      }}
                    />
                  </div>

                  {/* Priority mini pills (collapsed) */}
                  {!isExpanded && memberTasks.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {PRIORITIES.map(p => {
                        const count = byPriority[p.id] || 0;
                        if (count === 0) return null;
                        return (
                          <span key={p.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ backgroundColor: p.color + '20', color: p.color }}>
                            {count}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Expanded task list */}
                {isExpanded && memberTasks.length > 0 && (
                  <div className="border-t border-[var(--border-subtle)]/50 px-3 py-2 space-y-0.5">
                    {memberTasks
                      .sort((a, b) => {
                        const po: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
                        return (po[a.priority] ?? 9) - (po[b.priority] ?? 9);
                      })
                      .map(tk => {
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
                            <span className="text-[12px] flex-1 truncate text-[var(--text-primary)]">{tk.title}</span>
                            {hours ? (
                              <span className="text-[11px] text-[var(--text-muted)] shrink-0">{hours}h</span>
                            ) : (
                              <span className="text-[10px] text-[var(--warning)] shrink-0">
                                {lang === 'es' ? 'sin est.' : 'no est.'}
                              </span>
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

          {/* Unassigned tasks section */}
          {unassigned.length > 0 && (
            <div className="rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
              <div className="p-3 cursor-pointer hover:bg-[var(--bg-hover)]/50 transition"
                onClick={() => setExpandedMember(expandedMember === '__unassigned__' ? null : '__unassigned__')}>
                <div className="flex items-center gap-3 mb-1">
                  {expandedMember === '__unassigned__'
                    ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                  }
                  <div className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[11px] text-[var(--text-muted)] shrink-0">?</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--text-muted)]">
                      {lang === 'es' ? 'Sin asignar' : 'Unassigned'}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {unassigned.length} {lang === 'es' ? 'tareas' : 'tasks'}
                    </p>
                  </div>
                </div>
              </div>
              {expandedMember === '__unassigned__' && (
                <div className="border-t border-[var(--border-subtle)]/50 px-3 py-2 space-y-0.5">
                  {unassigned.map(tk => {
                    const pri = PRIORITIES.find(p => p.id === tk.priority);
                    const st = STATUSES.find(s => s.id === tk.status);
                    const isSelected = selectedTask?.id === tk.id;
                    return (
                      <div key={tk.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition hover:bg-[var(--bg-hover)] ${
                          isSelected ? 'bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/20' : ''
                        }`}
                        onClick={() => onSelect(tk)}>
                        <span className="text-[11px]">{pri?.icon}</span>
                        {st && <st.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: st.color }} />}
                        <span className="text-[12px] flex-1 truncate text-[var(--text-primary)]">{tk.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
