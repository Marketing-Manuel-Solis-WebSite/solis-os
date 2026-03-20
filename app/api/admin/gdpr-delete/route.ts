// ================================================================
// GDPR Data Deletion (Anonymization) API — POST /api/admin/gdpr-delete
// Requires authenticated admin user.
// Body: { userId: string, confirm: true }
// Anonymizes user data while preserving referential integrity.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logActionAdmin } from '@/lib/db-admin';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';

const ANON_NAME = '[Usuario eliminado]';
const ANON_EMAIL = '[redacted]';
const ANON_MESSAGE = '[Mensaje eliminado por GDPR]';
const ANON_DESCRIPTION = '[Descripción eliminada por GDPR]';
const BATCH_LIMIT = 450; // Firestore batch max is 500; leave margin

function apiOk(data: any) { return NextResponse.json(data, { status: 200 }); }
function apiErr(msg: string, status = 500) { return NextResponse.json({ error: msg }, { status }); }

/**
 * Commit operations in chunks of BATCH_LIMIT to respect Firestore's 500-op batch limit.
 * Each callback receives a batch and should add operations to it.
 * Returns the total number of operations committed.
 */
async function batchChunked(
  refs: FirebaseFirestore.DocumentReference[],
  updateFn: (batch: FirebaseFirestore.WriteBatch, ref: FirebaseFirestore.DocumentReference) => void,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();
    for (const ref of chunk) {
      updateFn(batch, ref);
    }
    await batch.commit();
    total += chunk.length;
  }
  return total;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — require admin role
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    // Rate limit: 5 req/min per admin user
    const rl = await checkRateLimit('gdpr-delete', authedUser.uid, 5);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 2. Get userId and confirmation from request body
    const body = await req.json();
    const userId = body?.userId as string;
    const confirm = body?.confirm as boolean;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return apiErr('userId is required', 400);
    }

    if (confirm !== true) {
      return apiErr('confirm: true is required to proceed with GDPR deletion', 400);
    }

    // Prevent admin from deleting themselves
    if (userId === authedUser.uid) {
      return apiErr('Cannot perform GDPR deletion on your own account', 400);
    }

    const summary: Record<string, number> = {};

    // 4. Log the delete action BEFORE anonymizing (so the actor's own audit logs still have their name)
    await logActionAdmin({
      action: 'gdpr_data_delete',
      resource: `user/${userId}`,
      detail: `GDPR data anonymization for user ${userId} requested by admin ${authedUser.uid}`,
      actorId: authedUser.uid,
      actorName: authedUser.email || authedUser.uid,
    });

    // 3. Anonymize user data

    // --- Member profile: anonymize PII fields ---
    const memberRef = adminDb.doc(`orgs/${ORG}/members/${userId}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) {
      await memberRef.update({
        displayName: ANON_NAME,
        email: ANON_EMAIL,
        photoURL: null,
        phone: null,
        bio: null,
        gdprAnonymized: true,
        gdprAnonymizedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      summary.memberProfile = 1;
    } else {
      summary.memberProfile = 0;
    }

    // --- Tasks created by user: anonymize createdByName ---
    const tasksCreatedSnap = await adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where('createdBy', '==', userId)
      .get();
    if (!tasksCreatedSnap.empty) {
      const refs = tasksCreatedSnap.docs.map(d => d.ref);
      summary.tasksCreatedAnonymized = await batchChunked(refs, (batch, ref) => {
        batch.update(ref, {
          createdByName: ANON_NAME,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } else {
      summary.tasksCreatedAnonymized = 0;
    }

    // --- Chat messages: anonymize displayName and content ---
    const channelsSnap = await adminDb.collection('channels')
      .where('orgId', '==', ORG)
      .get();
    let chatAnonymized = 0;
    for (const channelDoc of channelsSnap.docs) {
      const messagesSnap = await adminDb
        .collection(`channels/${channelDoc.id}/messages`)
        .where('userId', '==', userId)
        .get();
      if (!messagesSnap.empty) {
        const refs = messagesSnap.docs.map(d => d.ref);
        chatAnonymized += await batchChunked(refs, (batch, ref) => {
          batch.update(ref, {
            displayName: ANON_NAME,
            content: ANON_MESSAGE,
            edited: true,
            attachments: [],
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      }
    }
    summary.chatMessagesAnonymized = chatAnonymized;

    // --- Time entries: anonymize userName and notes ---
    const timeEntriesSnap = await adminDb.collection('time-entries')
      .where('orgId', '==', ORG)
      .where('userId', '==', userId)
      .get();
    if (!timeEntriesSnap.empty) {
      const refs = timeEntriesSnap.docs.map(d => d.ref);
      summary.timeEntriesAnonymized = await batchChunked(refs, (batch, ref) => {
        batch.update(ref, {
          userName: ANON_NAME,
          notes: ANON_DESCRIPTION,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } else {
      summary.timeEntriesAnonymized = 0;
    }

    // --- Notifications: delete all for this user ---
    const notificationsSnap = await adminDb
      .collection(`orgs/${ORG}/notifications`)
      .where('userId', '==', userId)
      .get();
    if (!notificationsSnap.empty) {
      const refs = notificationsSnap.docs.map(d => d.ref);
      summary.notificationsDeleted = await batchChunked(refs, (batch, ref) => {
        batch.delete(ref);
      });
    } else {
      summary.notificationsDeleted = 0;
    }

    // --- Form submissions: anonymize PII ---
    const formsSnap = await adminDb.collection('forms')
      .where('orgId', '==', ORG)
      .get();
    let formSubsAnonymized = 0;
    for (const formDoc of formsSnap.docs) {
      const subsSnap = await adminDb
        .collection(`forms/${formDoc.id}/submissions`)
        .where('createdBy', '==', userId)
        .get();
      if (!subsSnap.empty) {
        const refs = subsSnap.docs.map(d => d.ref);
        formSubsAnonymized += await batchChunked(refs, (batch, ref) => {
          batch.update(ref, {
            values: { _redacted: true },
            ip: null,
            userAgent: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      }
    }
    summary.formSubmissionsAnonymized = formSubsAnonymized;

    // --- Audit logs by user: anonymize actorName (keep structure for traceability) ---
    const auditLogsSnap = await adminDb.collection('auditLogs')
      .where('orgId', '==', ORG)
      .where('actorId', '==', userId)
      .get();
    if (!auditLogsSnap.empty) {
      const refs = auditLogsSnap.docs.map(d => d.ref);
      summary.auditLogsAnonymized = await batchChunked(refs, (batch, ref) => {
        batch.update(ref, {
          actorName: ANON_NAME,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } else {
      summary.auditLogsAnonymized = 0;
    }

    // 5. Return summary
    return apiOk({
      anonymizedAt: new Date().toISOString(),
      userId,
      requestedBy: authedUser.uid,
      summary,
    });
  } catch (err) {
    console.error('[GDPR-Delete] operation failed:', err);
    return apiErr('Internal error', 500);
  }
}
