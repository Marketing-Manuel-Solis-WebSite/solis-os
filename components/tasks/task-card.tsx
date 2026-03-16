'use client';

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { Calendar, Paperclip, MessageSquare, GitBranch, CheckSquare, Repeat } from 'lucide-react';
import {
  Task,
  PRIORITIES,
  VISIBILITY,
  getStatusConfig,
  getPriorityConfig,
  getTypeConfig,
  getVisibilityConfig,
  isOverdue,
  getSubtaskProgress,
} from './constants';

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

export default React.memo(function TaskCard({
  task,
  members,
  teams,
  isSelected,
  isDragging,
  compact,
  onSelect,
  onDragStart,
  onDragEnd,
}: Props) {
  const { t, lang } = useI18n();

  const priorityConfig = getPriorityConfig(task.priority);
  const statusConfig = getStatusConfig(task.status);
  const typeConfig = getTypeConfig(task.type || 'task');
  const due = task.dueDate?.toDate?.();
  const overdue = isOverdue(task);
  const isBlocked = task.status === 'blocked';
  const isDone = task.status === 'done';
  const taskTeam = teams.find((tm: any) => tm.id === task.teamId);
  const subtaskProgress = getSubtaskProgress(task);
  const attachmentCount = (task.attachments || []).length;
  const dependencyCount = (task.dependencies || []).length;
  const hasComments = !!(task as any).comments;

  const isUrgentOrHigh = task.priority === 'urgent' || task.priority === 'high';

  // ─── Compact mode (Calendar view) ───────────────────────────
  if (compact) {
    return (
      <div
        onClick={onSelect}
        className={`
          px-2.5 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer truncate
          border-l-[3px] transition-colors duration-150
          ${isSelected
            ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)] font-medium'
            : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
          }
        `}
        style={{ borderLeftColor: priorityConfig.color }}
      >
        {task.title}
      </div>
    );
  }

  // ─── Normal mode (Board view) ───────────────────────────────
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`
        p-4 rounded-2xl cursor-pointer
        border transition-all duration-200 ease-out
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isSelected
          ? 'bg-[var(--accent)]/5 shadow-lg shadow-[var(--accent)]/5 ring-1 ring-[var(--accent)]/30 border-[var(--accent)]/20'
          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--border)] shadow-card hover:shadow-md'
        }
      `}
    >
      {/* ── Top: Priority dot + Type icon + Title + Status indicators ── */}
      <div className="flex items-start gap-2 mb-1.5">
        {/* Priority indicator dot */}
        <span
          className="mt-[5px] shrink-0 w-2 h-2 rounded-full"
          style={{
            backgroundColor: priorityConfig.color,
            ...(isUrgentOrHigh ? { boxShadow: `0 0 6px ${priorityConfig.color}40` } : {}),
          }}
        />

        {/* Task type icon */}
        <typeConfig.Icon
          className="mt-[3px] shrink-0 h-3.5 w-3.5"
          style={{ color: typeConfig.color, opacity: 0.6 }}
        />

        {/* Title */}
        <p
          className={`
            text-[14px] font-medium flex-1 leading-snug
            ${isDone
              ? 'line-through text-[var(--text-muted)]'
              : 'text-[var(--text-primary)]'
            }
          `}
        >
          {task.title}
        </p>

        {/* Overdue / Blocked indicator */}
        {(overdue || isBlocked) && (
          <span
            className="mt-[3px] shrink-0 w-2 h-2 rounded-full animate-pulse"
            style={{
              backgroundColor: isBlocked
                ? statusConfig.color
                : '#EF4444',
            }}
          />
        )}
      </div>

      {/* ── Middle: Description ── */}
      {task.description && (
        <p className="text-[13px] text-[var(--text-muted)] mb-3 ml-6 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* ── Middle: Subtask progress ── */}
      {subtaskProgress.total > 0 && (
        <div className="mb-3 ml-6">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckSquare className="h-3 w-3 text-[var(--text-muted)]" />
            <span className="text-[12px] text-[var(--text-muted)]">
              {subtaskProgress.done}/{subtaskProgress.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--border-default)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${subtaskProgress.pct}%`,
                backgroundColor:
                  subtaskProgress.pct === 100
                    ? '#22C55E'
                    : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Bottom: Meta row ── */}
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {/* Team badge */}
        {taskTeam && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-md font-medium leading-none"
            style={{
              backgroundColor: `${taskTeam.color}15`,
              color: taskTeam.color,
            }}
          >
            {taskTeam.icon || taskTeam.name?.[0]?.toUpperCase()}
          </span>
        )}

        {/* Tags (max 2) */}
        {task.tags?.slice(0, 2).map((tag: string) => (
          <span
            key={tag}
            className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-hover)] text-[var(--text-muted)] leading-none"
          >
            {tag}
          </span>
        ))}
        {(task.tags?.length || 0) > 2 && (
          <span className="text-[10px] text-[var(--text-muted)]">
            +{task.tags!.length - 2}
          </span>
        )}

        {/* Due date */}
        {due && (
          <span
            className={`
              text-[11px] flex items-center gap-1 leading-none
              ${overdue ? 'text-red-400 font-medium' : 'text-[var(--text-muted)]'}
            `}
          >
            <Calendar className="h-3 w-3" />
            {due.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Attachment count */}
        {attachmentCount > 0 && (
          <span className="flex items-center gap-0.5 text-[var(--text-muted)]">
            <Paperclip className="h-3 w-3" />
            <span className="text-[11px]">{attachmentCount}</span>
          </span>
        )}

        {/* Comment indicator */}
        {hasComments && (
          <span className="text-[var(--text-muted)]">
            <MessageSquare className="h-3 w-3" />
          </span>
        )}

        {/* Dependency indicator */}
        {dependencyCount > 0 && (
          <span className="flex items-center gap-0.5 text-[var(--text-muted)]">
            <GitBranch className="h-3 w-3" />
            <span className="text-[11px]">{dependencyCount}</span>
          </span>
        )}

        {/* Recurrence indicator */}
        {task.recurrence && (
          <span className="text-[var(--accent)]" title={t('common.recurring')}>
            <Repeat className="h-3 w-3" />
          </span>
        )}

        {/* Assignee avatars (max 3 + overflow) */}
        {(task.assignees?.length || 0) > 0 && (
          <div className="flex -space-x-1.5 ml-1">
            {task.assignees?.slice(0, 3).map((uid: string) => {
              const member = members.find((x: any) => x.id === uid);
              const initials =
                member?.displayName?.[0]?.toUpperCase() ||
                member?.email?.[0]?.toUpperCase() ||
                '?';

              return member?.photoURL ? (
                <Image
                  key={uid}
                  src={member.photoURL}
                  alt={member.displayName || ''}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full border-2 border-[var(--bg-elevated)] object-cover"
                />
              ) : (
                <div
                  key={uid}
                  className="
                    w-6 h-6 rounded-full
                    bg-[var(--accent-subtle)]
                    border-2 border-[var(--bg-elevated)]
                    flex items-center justify-center
                    text-[9px] font-bold text-[var(--accent)]
                  "
                  title={member?.displayName || member?.email || ''}
                >
                  {initials}
                </div>
              );
            })}
            {(task.assignees?.length || 0) > 3 && (
              <div
                className="
                  w-6 h-6 rounded-full
                  bg-[var(--bg-hover)]
                  border-2 border-[var(--bg-elevated)]
                  flex items-center justify-center
                  text-[8px] font-medium text-[var(--text-muted)]
                "
              >
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
