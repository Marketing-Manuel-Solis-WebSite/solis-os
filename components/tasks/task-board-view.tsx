'use client';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Task, TaskGroup } from './constants';
import TaskCard from './task-card';
import TaskQuickAdd from './task-quick-add';

interface Props {
  groups: TaskGroup[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  canUpdate: boolean;
  onSelect: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onQuickCreate: (data: any) => void;
}

export default function TaskBoardView({ groups, members, teams, selectedTask, canUpdate, onSelect, onStatusChange, onQuickCreate }: Props) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedTask(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!(e.currentTarget as HTMLElement).contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== columnKey) {
      onStatusChange(draggedTask.id, columnKey);
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  }, [draggedTask, onStatusChange]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full px-6 py-3">
      {groups.map(group => (
        <div
          key={group.key}
          className={`w-72 shrink-0 flex flex-col rounded-xl p-2 transition-all duration-200 ${
            dragOverColumn === group.key ? 'bg-[var(--accent)]/5 ring-2 ring-[var(--accent)]/20' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, group.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, group.key)}
        >
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color, boxShadow: `0 0 8px ${group.color}40` }} />
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{group.label}</span>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{group.tasks.length}</span>
          </div>

          {/* Cards */}
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {/* Drop indicator at top */}
            {dragOverColumn === group.key && draggedTask && draggedTask.status !== group.key && (
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                className="h-1 rounded-full bg-[var(--accent)] mx-2"
              />
            )}

            {group.tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                teams={teams}
                isSelected={selectedTask?.id === task.id}
                isDragging={draggedTask?.id === task.id}
                onSelect={() => onSelect(task)}
                onDragStart={canUpdate ? (e) => handleDragStart(e, task) : undefined}
                onDragEnd={canUpdate ? handleDragEnd : undefined}
              />
            ))}
          </div>

          {/* Quick add */}
          {canUpdate && (
            <TaskQuickAdd
              groupKey={group.key}
              groupLabel={group.label}
              onAdd={(title) => onQuickCreate({ title, status: group.key })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
