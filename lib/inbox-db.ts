import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const ORG = 'solis-center';
const INBOX_PATH = `orgs/${ORG}/inbox`;

export interface InboxItem {
  id: string;
  userId: string;
  type: 'overdue_task' | 'goal_at_risk' | 'mention' | 'approval' | 'deadline_tomorrow';
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  status: 'pending' | 'snoozed' | 'done' | 'archived';
  snoozedUntil?: any;
  createdAt?: any;
}

export async function getInboxItems(userId: string): Promise<InboxItem[]> {
  const q = query(
    collection(db, INBOX_PATH),
    where('userId', '==', userId),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as InboxItem))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function createInboxItem(data: Omit<InboxItem, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, INBOX_PATH), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function snoozeInboxItem(id: string, hours = 4): Promise<void> {
  const snoozedUntil = Timestamp.fromDate(new Date(Date.now() + hours * 3600000));
  await updateDoc(doc(db, INBOX_PATH, id), { status: 'snoozed', snoozedUntil });
}

export async function archiveInboxItem(id: string): Promise<void> {
  await updateDoc(doc(db, INBOX_PATH, id), { status: 'archived' });
}

export async function markInboxDone(id: string): Promise<void> {
  await updateDoc(doc(db, INBOX_PATH, id), { status: 'done' });
}

// Generate inbox items from overdue tasks and at-risk goals
export async function generateInboxItems(userId: string, tasks: any[], goals: any[]): Promise<void> {
  // Get existing pending items to avoid duplicates
  const existing = await getInboxItems(userId);
  const existingIds = new Set(existing.map(e => `${e.type}:${e.entityId}`));

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);

  // Overdue tasks
  for (const task of tasks) {
    if (!task.dueDate || task.status === 'done' || task.status === 'completed') continue;
    if (!task.assignees?.includes(userId)) continue;
    const due = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    if (due < now && !existingIds.has(`overdue_task:${task.id}`)) {
      await createInboxItem({
        userId,
        type: 'overdue_task',
        title: task.title,
        message: `Venció el ${due.toLocaleDateString('es-MX')}`,
        entityType: 'task',
        entityId: task.id,
        status: 'pending',
      });
    }
  }

  // Tasks due tomorrow
  for (const task of tasks) {
    if (!task.dueDate || task.status === 'done' || task.status === 'completed') continue;
    if (!task.assignees?.includes(userId)) continue;
    const due = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    const isTomorrow = due.toDateString() === tomorrow.toDateString();
    if (isTomorrow && !existingIds.has(`deadline_tomorrow:${task.id}`)) {
      await createInboxItem({
        userId,
        type: 'deadline_tomorrow',
        title: task.title,
        message: `Vence mañana`,
        entityType: 'task',
        entityId: task.id,
        status: 'pending',
      });
    }
  }

  // At-risk goals
  for (const goal of goals) {
    if (goal.status === 'at_risk' || goal.status === 'behind') {
      if (!existingIds.has(`goal_at_risk:${goal.id}`)) {
        await createInboxItem({
          userId,
          type: 'goal_at_risk',
          title: goal.name,
          message: `Estado: ${goal.status === 'at_risk' ? 'En riesgo' : 'Atrasada'} — ${goal.progress || 0}%`,
          entityType: 'goal',
          entityId: goal.id,
          status: 'pending',
        });
      }
    }
  }
}
