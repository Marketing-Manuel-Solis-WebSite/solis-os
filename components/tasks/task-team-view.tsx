'use client';

// ============================================================
// Task Team View — Card-per-member layout with capacity bars,
// mini task cards, and unassigned column.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { Task, TaskGroup, PRIORITIES, STATUSES } from './constants';
import { Users, Clock, AlertTriangle, ChevronDown, ChevronRight, UserX } from 'lucide-react';
import { DEFAULT_CAPACITY } from '@/lib/workload-utils';

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

// ─── Capacity calculator (pure, exported for testing) ───
export function calculateCapacity(
  tasks: Task[],
  weeklyHours: number = DEFAULT_CAPACITY,
): {
  totalEstimateMinutes: number;
  capacityMinutes: number;
  percentage: number;
  status: 'underload' | 'optimal' | 'overload';
} {
  const totalEstimateMinutes = tasks.reduce((sum, t) => sum + (t.timeEstimate || 0), 0);
  const capacityMinutes = weeklyHours * 60;
  const percentage = capacityMinutes > 0 ? (totalEstimateMinutes / capacityMinutes) * 100 : 0;
  const status: 'underload' | 'optimal' | 'overload' =
    percentage > 100 ? 'overload' :
    percentage >= 70 ? 'optimal' :
    'underload';
  return { totalEstimateMinutes, capacityMinutes, percentage, status };
}

// ─── Component ──────────────────────────────────────────
export default function TaskTeamView({
  groups, members, selectedTask, onSelect,
}: Props) {
  const { lang } = useI18n();
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const allTasks = useMemo(() => groups.flatMap(g => g.tasks), [groups]);
  const activeTasks = useMemo(() => allTasks.filter(t => t.status !== 'done'), [allTasks]);

  // Build member cards
  const memberCards = useMemo(() => {
    return members.map(member => {
      const cap = member.capacityHoursPerWeek ?? DEFAULT_CAPACITY;
      const memberTasks = activeTasks.filter(t => t.assignees?.includes(member.id));
      const { totalEstimateMinutes, percentage, status } = calculateCapacity(memberTasks, cap);
      const totalHours = totalEstimateMinutes / 60;

      return { member, tasks: memberTasks, totalHours, capacityHours: cap, percentage, status };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [activeTasks, members]);

  const unassigned = useMemo(() => activeTasks.filter(t => !t.assignees?.length), [activeTasks]);

  const overloadCount = memberCards.filter(m => m.status === 'overload').length;

  const barColor = (status: string) =>
    status === 'overload' ? 'var(--error)' :
    status === 'optimal' ? 'var(--success)' : 'var(--accent)';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[12px]">
            <Users className="h-3.5 w-3.5 text-[var(--info)]" />
            <span className="text-[var(--text-muted)]">
              {memberCards.length} {lang === 'es' ? 'miembros' : 'members'}
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
      </div>

      {/* Grid */}
      {memberCards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{lang === 'es' ? 'No hay miembros del equipo' : 'No team members'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-min">
          {memberCards.map(({ member, tasks: memberTasks, totalHours, capacityHours, percentage, status }) => {
            const isExpanded = expandedMember === member.id;
            return (
              <div key={member.id} className="rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden flex flex-col">
                {/* Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-[var(--bg-hover)]/50 transition"
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />}
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
                      </p>
                    </div>
                    <span className={`text-[12px] font-bold shrink-0 ${
                      status === 'overload' ? 'text-[var(--error)]' :
                      status === 'optimal' ? 'text-[var(--success)]' :
                      'text-[var(--text-muted)]'
                    }`}>
                      {Math.round(percentage)}%
                    </span>
                  </div>

                  {/* Capacity bar */}
                  <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: barColor(status),
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                      {totalHours.toFixed(1)}h / {capacityHours}h
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                      status === 'overload' ? 'bg-[var(--error)]/10 text-[var(--error)]' :
                      status === 'optimal' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                      'bg-[var(--accent)]/10 text-[var(--accent)]'
                    }`}>
                      {status === 'overload' ? (lang === 'es' ? 'Sobrecargado' : 'Overloaded') :
                       status === 'optimal' ? (lang === 'es' ? 'Óptimo' : 'Optimal') :
                       (lang === 'es' ? 'Disponible' : 'Available')}
                    </span>
                  </div>
                </div>

                {/* Expanded task list */}
                {isExpanded && memberTasks.length > 0 && (
                  <div className="border-t border-[var(--border-subtle)]/50 px-3 py-2 space-y-0.5 max-h-60 overflow-y-auto">
                    {memberTasks
                      .sort((a, b) => {
                        const po: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
                        return (po[a.priority] ?? 9) - (po[b.priority] ?? 9);
                      })
                      .map(tk => {
                        const pri = PRIORITIES.find(p => p.id === tk.priority);
                        const st = STATUSES.find(s => s.id === tk.status);
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
                {isExpanded && memberTasks.length === 0 && (
                  <div className="border-t border-[var(--border-subtle)]/50 px-3 py-3 text-center text-[12px] text-[var(--text-muted)]">
                    {lang === 'es' ? 'Sin tareas asignadas' : 'No tasks assigned'}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned card */}
          {unassigned.length > 0 && (
            <div className="rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden border border-dashed border-[var(--border)]">
              <div
                className="p-3 cursor-pointer hover:bg-[var(--bg-hover)]/50 transition"
                onClick={() => setExpandedMember(expandedMember === '__unassigned__' ? null : '__unassigned__')}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  {expandedMember === '__unassigned__'
                    ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />}
                  <div className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
                    <UserX className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--text-muted)]">
                      {lang === 'es' ? 'Sin Asignar' : 'Unassigned'}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {unassigned.length} {lang === 'es' ? 'tareas' : 'tasks'}
                    </p>
                  </div>
                </div>
              </div>
              {expandedMember === '__unassigned__' && (
                <div className="border-t border-[var(--border-subtle)]/50 px-3 py-2 space-y-0.5 max-h-60 overflow-y-auto">
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
