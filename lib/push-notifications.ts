// ============================================================
// Push Notifications — Web Push via FCM
// ============================================================
// Client-side: request permission, get FCM token, save to Firestore.
// Server-side: send push via Firebase Admin SDK (in notify-admin.ts).

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId } from './org';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

/**
 * Request push notification permission and subscribe to FCM.
 * Returns the FCM token if successful, null otherwise.
 */
export async function requestPushPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const app = getApps().length ? getApp() : initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    return token || null;
  } catch (err) {
    console.error('[Push] Failed to get FCM token:', err);
    return null;
  }
}

/**
 * Save FCM token to Firestore for server-side delivery.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const orgId = getCurrentOrgId();
  const tokenRef = doc(db, `orgs/${orgId}/members/${userId}/pushTokens`, token);
  await setDoc(tokenRef, {
    token,
    platform: 'web',
    userAgent: navigator.userAgent,
    createdAt: serverTimestamp(),
  });
}

/**
 * Remove FCM token from Firestore (on logout or permission revoke).
 */
export async function removePushToken(userId: string, token: string): Promise<void> {
  const orgId = getCurrentOrgId();
  const tokenRef = doc(db, `orgs/${orgId}/members/${userId}/pushTokens`, token);
  await deleteDoc(tokenRef);
}

/**
 * Subscribe to foreground messages (shows toast instead of native notification).
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (typeof window === 'undefined') return null;
  try {
    const { getApps, getApp } = require('firebase/app');
    const app = getApps().length ? getApp() : null;
    if (!app) return null;
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch {
    return null;
  }
}

/**
 * Full setup: request permission, get token, save to Firestore.
 * Call this on login or when user enables push in preferences.
 */
export async function setupPushNotifications(userId: string): Promise<boolean> {
  const token = await requestPushPermission();
  if (!token) return false;
  await savePushToken(userId, token);
  return true;
}
