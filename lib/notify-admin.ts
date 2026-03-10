// ============================================================
// Server-Side Unified Notification Dispatch
// ============================================================
//
// Replaces scattered notifyManyAdmin() calls in admin dispatchers.
// For each notification:
//   1. Dedup check (if policy says so)
//   2. Create in-app notification (Firestore)
//   3. Send email via Resend (if policy + user preferences allow)
//   4. Create inbox item (if policy says so)
//
// All errors are tracked and returned, never silently swallowed.
// ============================================================

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  NOTIFICATION_MATRIX,
  buildDedupeKey,
  type NotificationEventType,
} from './notification-matrix';
import { sendNotificationEmail } from './send-notification-email';

const ORG = 'solis-center';

export interface NotifyParams {
  eventType: NotificationEventType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  actorId?: string;
  actorName?: string;
}

export interface NotifyResult {
  userId: string;
  notificationCreated: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  emailError?: string;
  inboxCreated: boolean;
  deduped: boolean;
}

export async function notifyUserAdmin(
  userId: string,
  params: NotifyParams,
): Promise<NotifyResult> {
  const result: NotifyResult = {
    userId,
    notificationCreated: false,
    emailSent: false,
    emailSkipped: false,
    inboxCreated: false,
    deduped: false,
  };

  const policy = NOTIFICATION_MATRIX[params.eventType];
  if (!policy) {
    console.warn(`[notify-admin] No policy for: ${params.eventType}`);
    return result;
  }

  const dedupeKey = buildDedupeKey(
    policy.dedupeStrategy,
    params.eventType,
    params.entityId,
    params.actorId,
  );

  // Dedup: check for existing unread notification with same dedupeKey
  if (dedupeKey) {
    try {
      const existing = await adminDb
        .collection(`orgs/${ORG}/notifications`)
        .where('userId', '==', userId)
        .where('dedupeKey', '==', dedupeKey)
        .where('read', '==', false)
        .limit(1)
        .get();
      if (!existing.empty) {
        result.deduped = true;
        return result;
      }
    } catch (err) {
      // Dedup failure should not block notification creation
      console.error('[notify-admin] dedup check failed:', err);
    }
  }

  // 1. Create in-app notification
  if (policy.inApp) {
    try {
      await adminDb.collection(`orgs/${ORG}/notifications`).add({
        userId,
        type: params.eventType,
        title: params.title,
        message: params.message,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        entityUrl: params.entityUrl || null,
        actorId: params.actorId || null,
        actorName: params.actorName || null,
        dedupeKey: dedupeKey || null,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      result.notificationCreated = true;
    } catch (err: any) {
      console.error(`[notify-admin] notification creation failed for ${userId}:`, err?.message);
    }
  }

  // 2. Send email (if policy allows)
  if (policy.email) {
    try {
      const memberSnap = await adminDb.doc(`orgs/${ORG}/members/${userId}`).get();
      const memberData = memberSnap.data();

      if (!memberData?.email) {
        result.emailSkipped = true;
        result.emailError = 'No email on member profile';
      } else if (memberData.preferences?.notifications?.email === false) {
        result.emailSkipped = true;
      } else {
        const emailResult = await sendNotificationEmail({
          to: memberData.email,
          type: params.eventType,
          title: params.title,
          message: params.message,
          actorName: params.actorName,
          entityUrl: params.entityUrl,
        });
        result.emailSent = emailResult.success;
        if (!emailResult.success) {
          result.emailError = emailResult.error;
        }
      }
    } catch (err: any) {
      result.emailError = err?.message || 'Email resolution failed';
      console.error(`[notify-admin] email failed for ${userId}:`, err?.message);
    }
  }

  // 3. Create inbox item (if policy allows)
  if (policy.inbox && params.entityId) {
    try {
      const inboxType = policy.inboxType || params.eventType;
      const inboxDedupeKey = `${inboxType}:${params.entityId}`;

      // Check for existing pending inbox item with same key
      const existingInbox = await adminDb
        .collection(`orgs/${ORG}/inbox`)
        .where('userId', '==', userId)
        .where('dedupeKey', '==', inboxDedupeKey)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (existingInbox.empty) {
        await adminDb.collection(`orgs/${ORG}/inbox`).add({
          userId,
          type: inboxType,
          title: params.title,
          message: params.message,
          entityType: params.entityType || null,
          entityId: params.entityId,
          dedupeKey: inboxDedupeKey,
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
        });
        result.inboxCreated = true;
      }
    } catch (err: any) {
      console.error(`[notify-admin] inbox item failed for ${userId}:`, err?.message);
    }
  }

  return result;
}

/** Notify multiple users with the same params. Returns per-user results. */
export async function notifyUsersAdmin(
  userIds: string[],
  params: NotifyParams,
): Promise<NotifyResult[]> {
  return Promise.all(userIds.map(uid => notifyUserAdmin(uid, params)));
}
