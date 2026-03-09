import { createTask } from './db';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, Timestamp, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { ORG } from './db';
import { calculateNextDueDate, shouldGenerateNext, type RecurrenceConfig } from './recurrence';

// Called when a task with recurrence is marked done
// Creates the next instance if allowed by config
// Uses a Firestore transaction on the template to prevent race conditions
export async function handleTaskCompletion(task: any): Promise<string | null> {
  const config = task.recurrence as RecurrenceConfig | undefined;
  if (!config) return null;

  // Calculate next due date
  const currentDue = task.dueDate?.toDate?.() || new Date();
  const nextDue = calculateNextDueDate(config, currentDue);

  // Check if generation is allowed (pass nextDue for correct endDate comparison)
  if (!shouldGenerateNext(config, nextDue)) return null;

  // Idempotency check: targeted query instead of loading ALL tasks
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

  // Use transaction to atomically read fresh occurrence count and update template
  // This prevents the race condition where concurrent completions both read the same count
  const templateRef = doc(db, `tasks/${task.id}`);
  const freshCount = await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(templateRef);
    if (!freshSnap.exists()) throw new Error('Template task no longer exists');
    const freshData = freshSnap.data();
    const freshConfig = freshData.recurrence as RecurrenceConfig;
    const newCount = (freshConfig?.occurrenceCount || 0) + 1;

    // Update occurrence count atomically within the transaction
    transaction.update(templateRef, {
      recurrence: { ...freshConfig, occurrenceCount: newCount },
      updatedAt: serverTimestamp(),
    });

    return newCount;
  });

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
  return ref.id;
}
