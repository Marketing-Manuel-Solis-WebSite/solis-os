// ============================================================
// Task Links — Server-side (Admin SDK) helpers
// ============================================================
// Separated from task-links.ts to prevent firebase-admin from
// being bundled into client-side code.

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';
import type { TaskLink, TaskLinkStatus } from './task-links';

export async function addTaskLinkAdmin(
  link: Omit<TaskLink, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await adminDb.collection('taskLinks').add({
    ...link,
    orgId: ORG,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateTaskLinkStatusAdmin(
  externalId: string,
  provider: string,
  status: TaskLinkStatus,
): Promise<void> {
  const snap = await adminDb.collection('taskLinks')
    .where('externalId', '==', externalId)
    .where('provider', '==', provider)
    .where('orgId', '==', ORG)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
