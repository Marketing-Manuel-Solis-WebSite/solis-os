'use client';
import { Calendar } from 'lucide-react';
import { PRIORITIES, VISIBILITY } from './constants';

interface TaskGroup {
  key: string;
  label: string;
  color: string;
  tasks: any[];
}

interface Props {
  groups: TaskGroup[];
  teams: any[];
  members: any[];
  selectedId: string | null;
  onSelect: (task: any) => void;
}

export default function TaskBoardView({ groups, teams, members, selectedId, onSelect }: Props) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {groups.map(g => (
        <div key={g.key} className="w-72 shrink-0 flex flex-col">
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color, boxShadow: `0 0 8px ${g.color}40` }} />
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{g.label}</span>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{g.tasks.length}</span>
          </div>

          {/* Cards */}
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {g.tasks.map((t: any) => {
              const pri = PRIORITIES.find(x => x.id === t.priority);
              const due = t.dueDate?.toDate?.();
              const overdue = due && due < new Date() && t.status !== 'done';
              const visConf = VISIBILITY.find(v => v.id === (t.visibility || 'team'));
              const taskTeam = teams.find(tm => tm.id === t.teamId);
              const doneSub = (t.subtasks || []).filter((s: any) => s.done).length;
              const totalSub = (t.subtasks || []).length;

              return (
                <div key={t.id} onClick={() => onSelect(t)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${selectedId === t.id ? 'bg-[#D4A843]/5 border-[#D4A843]/30 shadow-lg shadow-[#D4A843]/5' : 'bg-[var(--bg-card)] border-[var(--border)]/50 hover:border-[var(--bg-elevated)] hover:shadow-md'}`}>
                  {/* Priority + Title */}
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="text-xs mt-0.5">{pri?.icon}</span>
                    <p className={`text-sm font-medium flex-1 leading-snug ${t.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{t.title}</p>
                  </div>

                  {/* Description preview */}
                  {t.description && <p className="text-[11px] text-[var(--text-muted)] mb-2.5 line-clamp-2 ml-5">{t.description}</p>}

                  {/* Subtask progress */}
                  {totalSub > 0 && (
                    <div className="mb-2.5 ml-5">
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mb-1">
                        <span>{doneSub}/{totalSub} subtareas</span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#D4A843] to-[#E8C85A] transition-all" style={{ width: `${totalSub > 0 ? (doneSub / totalSub * 100) : 0}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {taskTeam && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${taskTeam.color}15`, color: taskTeam.color }}>
                        {taskTeam.icon}
                      </span>
                    )}
                    {visConf && <visConf.Icon className="h-3 w-3" style={{ color: visConf.color }} />}
                    {t.tags?.slice(0, 2).map((tg: string) => (
                      <span key={tg} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">{tg}</span>
                    ))}
                    {due && (
                      <span className={`text-[10px] flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                        <Calendar className="h-3 w-3" />
                        {due.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <div className="flex-1" />
                    {/* Assignee avatars */}
                    <div className="flex -space-x-1">
                      {t.assignees?.slice(0, 3).map((uid: string) => {
                        const m = members.find((x: any) => x.id === uid);
                        return (
                          <div key={uid} className="w-5 h-5 rounded-full bg-[#D4A843]/15 border border-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[#D4A843]">
                            {m?.displayName?.[0]?.toUpperCase() || '?'}
                          </div>
                        );
                      })}
                      {(t.assignees?.length || 0) > 3 && (
                        <div className="w-5 h-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--bg-card)] flex items-center justify-center text-[7px] text-[var(--text-muted)]">
                          +{t.assignees.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
