import { createTask, updateTask, getTasks } from './db';
import { Timestamp } from 'firebase/firestore';
import { calculateNextDueDate, shouldGenerateNext, type RecurrenceConfig } from './recurrence';

// Called when a task with recurrence is marked done
// Creates the next instance if allowed by config
export async function handleTaskCompletion(task: any): Promise<string | null> {
  const config = task.recurrence as RecurrenceConfig | undefined;
  if (!config) return null;
  if (!shouldGenerateNext(config)) return null;

  // Calculate next due date
  const currentDue = task.dueDate?.toDate?.() || new Date();
  const nextDue = calculateNextDueDate(config, currentDue);

  // Idempotency check: see if an instance for this date already exists
  const existingTasks = await getTasks();
  const exists = (existingTasks as any[]).some(t =>
    t.recurrenceTemplateId === task.id &&
    t.dueDate?.toDate?.()?.toDateString() === nextDue.toDateString()
  );
  if (exists) return null;

  // Clone task for next instance
  const instanceData: any = {
    title: task.title,
    description: task.description || '',
    status: 'open',
    priority: task.priority || 'medium',
    assignees: task.assignees || [],
    tags: task.tags || [],
    teamId: task.teamId || '',
    type: task.type || 'task',
    visibility: task.visibility || 'team',
    customFields: task.customFields || {},
    dueDate: Timestamp.fromDate(nextDue),
    recurrence: {
      ...config,
      occurrenceCount: (config.occurrenceCount || 0) + 1,
    },
    isRecurrenceTemplate: false,
    recurrenceTemplateId: task.id,
    recurrenceInstanceDate: Timestamp.fromDate(nextDue),
    // Reset subtasks to unchecked
    subtasks: (task.subtasks || []).map((s: any) => ({ ...s, done: false })),
    createdBy: task.createdBy,
    createdByName: task.createdByName || '',
  };

  const ref = await createTask(instanceData);

  // Update the original task's occurrence count
  await updateTask(task.id, {
    recurrence: {
      ...config,
      occurrenceCount: (config.occurrenceCount || 0) + 1,
    },
  });

  return ref.id;
}
