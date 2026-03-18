import 'server-only';

import { FieldValue, ORG, adminDb, addTo } from './helpers';

// ===== NOTIFICATIONS (server-side) =====

export async function createNotificationAdmin(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  actorId?: string;
  actorName?: string;
}) {
  return adminDb.collection(`orgs/${ORG}/notifications`).add({
    ...data,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function notifyManyAdmin(
  userIds: string[],
  data: Omit<Parameters<typeof createNotificationAdmin>[0], 'userId'>,
) {
  return Promise.all(userIds.map(userId => createNotificationAdmin({ ...data, userId })));
}

// ===== AUDIT LOG (server-side) =====

export async function logActionAdmin(data: {
  action: string;
  resource: string;
  detail: string;
  actorId: string;
  actorName: string;
}) {
  return addTo('auditLogs', { ...data, orgId: ORG });
}

// ===== TASK ACTIVITY (server-side) =====

export async function addTaskActivityAdmin(taskId: string, data: {
  action: string;
  field?: string;
  from?: string;
  to?: string;
  actorId: string;
  actorName: string;
}) {
  return addTo(`tasks/${taskId}/activity`, data);
}
