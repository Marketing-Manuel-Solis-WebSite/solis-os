import { createTask, updateTask } from './db';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ORG } from './db';
import { calculateNextDueDate, shouldGenerateNext, type RecurrenceConfig } from './recurrence';

// Called when a task with recurrence is marked done
// Creates the next instance if allowed by config
export async function handleTaskCompletion(task: any): Promise<string | null> {
  const config = task.recurrence as RecurrenceConfig | undefined;
  if (!config) return null;

  // Calculate next due date
  const currentDue = task.dueDate?.toDate?.() || new Date();
  const nextDue = calculateNextDueDate(config, currentDue);

  // Check if generation is allowed (pass nextDue for correct endDate comparison)
  if (!shouldGenerateNext(config, nextDue)) return null;

  // Idempotency check: targeted query instead of loading ALL tasks
  // Only fetches instances of THIS template (O(1) vs O(N))
  const nextDueISO = nextDue.toISOString().slice(0, 10); // YYYY-MM-DD
  const instancesSnap = await getDocs(query(
    collection(db, 'tasks'),
    where('orgId', '==', ORG),
    where('recurrenceTemplateId', '==', task.id),
  ));
  const exists = instancesSnap.docs.some(d => {
    const data = d.data();
    return data.dueDate?.toDate?.()?.toISOString().slice(0, 10) === nextDueISO;
  });
  if (exists) return null;

  // Re-read the template's current occurrenceCount to reduce race window
  const freshCount = (config.occurrenceCount || 0) + 1;

  // Deep-copy customFields to avoid shared references
  let clonedCustomFields: Record<string, unknown> = {};
  try {
    clonedCustomFields = JSON.parse(JSON.stringify(task.customFields || {}));
  } catch {
    clonedCustomFields = {};
  }

  // Clone task for next instance
  const instanceData: Record<string, unknown> = {
    title: task.title,
    description: task.description || '',
    status: 'todo',
    priority: task.priority || 'medium',
    assignees: task.assignees || [],
    tags: task.tags || [],
    teamId: task.teamId || '',
    type: task.type || 'task',
    visibility: task.visibility || 'team',
    customFields: clonedCustomFields,
    dueDate: Timestamp.fromDate(nextDue),
    recurrence: {
      ...config,
      occurrenceCount: freshCount,
    },
    isRecurrenceTemplate: false,
    recurrenceTemplateId: task.id,
    recurrenceInstanceDate: Timestamp.fromDate(nextDue),
    // Reset subtasks and checklist items to unchecked
    subtasks: (task.subtasks || []).map((s: any) => ({ ...s, done: false })),
    checklist: (task.checklist || []).map((c: any) => ({ ...c, done: false })),
    createdBy: task.createdBy,
    createdByName: task.createdByName || '',
  };

  const ref = await createTask(instanceData);

  // Update the original task's occurrence count
  await updateTask(task.id, {
    recurrence: {
      ...config,
      occurrenceCount: freshCount,
    },
  });

  return ref.id;
}
