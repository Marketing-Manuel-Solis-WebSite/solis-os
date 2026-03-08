// ================================================================
// Server-side Firebase Admin SDK — singleton for Next.js App Router
// ================================================================
// Required env vars (server-only, NOT NEXT_PUBLIC_*):
//   FIREBASE_SERVICE_ACCOUNT_KEY  — JSON string of the service account key
//   OR the individual vars:
//     FIREBASE_PROJECT_ID
//     FIREBASE_CLIENT_EMAIL
//     FIREBASE_PRIVATE_KEY
// ================================================================

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getCredential(): ServiceAccount | undefined {
  // Option 1: full JSON key (recommended for production)
  const jsonKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonKey) {
    try {
      return JSON.parse(jsonKey) as ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
  }

  // Option 2: individual env vars
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey } as ServiceAccount;
  }

  return undefined;
}

function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const credential = getCredential();
  if (!credential) {
    // Fallback: initialize with project ID only (works in Google Cloud environments)
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (projectId) {
      return initializeApp({ projectId });
    }
    throw new Error(
      'Firebase Admin SDK: No credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY',
    );
  }

  return initializeApp({ credential: cert(credential) });
}

const app = initAdmin();

/** Admin Firestore — bypasses security rules, use only in server routes */
export const adminDb = getFirestore(app);

/** Admin Auth — server-side token verification & user management */
export const adminAuth = getAuth(app);
