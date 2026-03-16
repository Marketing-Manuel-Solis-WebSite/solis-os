'use client';

// ============================================================
// Mobile Task Card — Touch-friendly card with swipe gestures
// for quick complete/archive on mobile devices.
// ============================================================

import React, { useRef, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { STATUSES, PRIORITIES, type Task } from '@/components/tasks/constants';
import { CheckCircle2, Archive } from 'lucide-react';

interface Props {
  task: Task;
  onSelect: (task: Task) => void;
  onComplete: (taskId: string) => void;
  onArchive: (taskId: string) => void;
}

export default function MobileTaskCard({ task, onSelect, onComplete, onArchive }: Props) {
  const { lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  const st = STATUSES.find(s => s.id === task.status);
  const pri = PRIORITIES.find(p => p.id === task.priority);
  const due = task.dueDate?.toDate?.();
  const isOverdue = due && due < new Date() && task.status !== 'done';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    // Limit drag range
    const clamped = Math.max(-120, Math.min(120, dx));
    setOffsetX(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    if (offsetX > 80) {
      onComplete(task.id);
    } else if (offsetX < -80) {
      onArchive(task.id);
    }
    setOffsetX(0);
  }, [offsetX, task.id, onComplete, onArchive]);

  const bgColor = offsetX > 40 ? 'rgba(34, 197, 94, 0.15)' // green = complete
    : offsetX < -40 ? 'rgba(239, 68, 68, 0.15)' // red = archive
    : 'transparent';

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ backgroundColor: bgColor }}>
      {/* Swipe indicators */}
      {offsetX > 40 && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[var(--success)]">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-[11px] font-bold">{lang === 'es' ? 'Completar' : 'Complete'}</span>
        </div>
      )}
      {offsetX < -40 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[var(--error)]">
          <span className="text-[11px] font-bold">{lang === 'es' ? 'Archivar' : 'Archive'}</span>
          <Archive className="h-5 w-5" />
        </div>
      )}

      {/* Card */}
      <div
        ref={ref}
        className="relative bg-[var(--bg-elevated)] p-4 rounded-xl shadow-card transition-transform"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onSelect(task)}
      >
        <div className="flex items-start gap-3">
          {/* Status dot */}
          <div className="mt-1 w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: st?.color || '#94A3B8' }} />

          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className="text-[14px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
              {task.title}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {pri && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: pri.color + '20', color: pri.color }}>
                  {pri.icon}
                </span>
              )}
              {due && (
                <span className={`text-[11px] ${isOverdue ? 'text-[var(--error)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                  {due.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {task.assignees?.length > 0 && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {task.assignees.length} {lang === 'es' ? 'asig.' : 'assign.'}
                </span>
              )}
              {task.subtasks?.length > 0 && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
