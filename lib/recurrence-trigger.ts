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

  const nextDueISO = nextDue.toISOString().slice(0, 10); // YYYY-MM-DD

  // Fast-path: skip if instance already exists (non-authoritative, avoids transaction overhead)
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

  // Transaction: atomically check idempotency + increment occurrence count.
  // lastGeneratedDue on the template is the authoritative gate — prevents duplicates
  // even if two concurrent completions both pass the fast-path check above.
  const templateRef = doc(db, `tasks/${task.id}`);
  const freshCount = await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(templateRef);
    if (!freshSnap.exists()) throw new Error('Template task no longer exists');
    const freshData = freshSnap.data();
    const freshConfig = freshData.recurrence as RecurrenceConfig;

    // Authoritative idempotency: reject if this due date was already generated
    if (freshConfig?.lastGeneratedDue === nextDueISO) return null;

    const newCount = (freshConfig?.occurrenceCount || 0) + 1;
    transaction.update(templateRef, {
      recurrence: { ...freshConfig, occurrenceCount: newCount, lastGeneratedDue: nextDueISO },
      updatedAt: serverTimestamp(),
    });

    return newCount;
  });

  if (freshCount === null) return null;

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
