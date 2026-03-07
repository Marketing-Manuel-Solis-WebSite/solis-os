import {
  collection, doc, addDoc, updateDoc, getDocs, query, where,
  orderBy, limit, serverTimestamp, onSnapshot, writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';

const ORG = 'solis-center';
const NOTIF_COL = `orgs/${ORG}/notifications`;

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  actorId?: string;
  actorName?: string;
  read: boolean;
  createdAt: any;
}

// Create a notification for a specific user
export async function createNotification(data: {
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
  const ref = await addDoc(collection(db, NOTIF_COL), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });

  // Try to send email notification (best-effort, requires auth)
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (idToken) {
      await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          actorName: data.actorName || '',
        }),
      });
    }
  } catch { /* email is best-effort */ }

  return ref;
}

// Notify multiple users at once
export async function notifyMany(userIds: string[], data: Omit<Parameters<typeof createNotification>[0], 'userId'>) {
  return Promise.all(userIds.map(userId => createNotification({ ...data, userId })));
}

// Get user's notifications (most recent 50)
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const q = query(
    collection(db, NOTIF_COL),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
}

// Real-time listener
export function onNotificationsSnapshot(userId: string, callback: (notifs: AppNotification[]) => void) {
  const q = query(
    collection(db, NOTIF_COL),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
  });
}

// Mark single notification as read
export async function markNotificationRead(notifId: string) {
  return updateDoc(doc(db, NOTIF_COL, notifId), { read: true });
}

// Mark all as read for a user
export async function markAllRead(userId: string) {
  const q = query(
    collection(db, NOTIF_COL),
    where('userId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  return batch.commit();
}

// Get unread count
export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(
    collection(db, NOTIF_COL),
    where('userId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  return snap.size;
}
