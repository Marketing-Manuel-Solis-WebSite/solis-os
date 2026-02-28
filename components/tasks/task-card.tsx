'use client';
import { Calendar } from 'lucide-react';
import { PRIORITIES, VISIBILITY, Task } from './constants';

interface Props {
  task: Task;
  members: any[];
  teams: any[];
  isSelected: boolean;
  isDragging?: boolean;
  compact?: boolean;
  onSelect: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export default function TaskCard({ task, members, teams, isSelected, isDragging, compact, onSelect, onDragStart, onDragEnd }: Props) {
  const pri = PRIORITIES.find(x => x.id === task.priority);
  const due = task.dueDate?.toDate?.();
  const overdue = due && due < new Date() && task.status !== 'done';
  const visConf = VISIBILITY.find(v => v.id === (task.visibility || 'team'));
  const taskTeam = teams.find((tm: any) => tm.id === task.teamId);
  const doneSub = (task.subtasks || []).filter(s => s.done).length;
  const totalSub = (task.subtasks || []).length;

  if (compact) {
    return (
      <div onClick={onSelect}
        className={`px-2 py-1 rounded-md text-[10px] cursor-pointer truncate border-l-2 transition ${
          isSelected ? 'bg-[#D4A843]/10 text-[var(--text-primary)]' : 'bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
        }`}
        style={{ borderLeftColor: pri?.color || '#64748B' }}>
        {task.title}
      </div>
    );
  }

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isSelected
          ? 'bg-[#D4A843]/5 border-[#D4A843]/30 shadow-lg shadow-[#D4A843]/5'
          : 'bg-[var(--bg-card)] border-[var(--border)]/50 hover:border-[var(--bg-elevated)] hover:shadow-md'
      }`}
    >
      {/* Priority + Title */}
      <div className="flex items-start gap-2 mb-1.5">
        <span className="text-xs mt-0.5">{pri?.icon}</span>
        <p className={`text-sm font-medium flex-1 leading-snug ${task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
          {task.title}
        </p>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="text-[11px] text-[var(--text-muted)] mb-2.5 line-clamp-2 ml-5">{task.description}</p>
      )}

      {/* Subtask progress */}
      {totalSub > 0 && (
        <div className="mb-2.5 ml-5">
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mb-1">
            <span>{doneSub}/{totalSub} subtareas</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#D4A843] to-[#E8C85A] transition-all"
              style={{ width: `${totalSub > 0 ? (doneSub / totalSub * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {taskTeam && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
            style={{ backgroundColor: `${taskTeam.color}15`, color: taskTeam.color }}>
            {taskTeam.icon}
          </span>
        )}
        {visConf && <visConf.Icon className="h-3 w-3" style={{ color: visConf.color }} />}
        {task.tags?.slice(0, 2).map((tg: string) => (
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
          {task.assignees?.slice(0, 3).map((uid: string) => {
            const m = members.find((x: any) => x.id === uid);
            return (
              <div key={uid} className="w-5 h-5 rounded-full bg-[#D4A843]/15 border border-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[#D4A843]">
                {m?.displayName?.[0]?.toUpperCase() || '?'}
              </div>
            );
          })}
          {(task.assignees?.length || 0) > 3 && (
            <div className="w-5 h-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--bg-card)] flex items-center justify-center text-[7px] text-[var(--text-muted)]">
              +{task.assignees.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
