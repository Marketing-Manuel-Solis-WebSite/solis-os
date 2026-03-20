// ================================================================
// GDPR Data Export API — POST /api/admin/gdpr-export
// Requires authenticated admin user.
// Body: { userId: string }
// Returns all data associated with the given userId.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logActionAdmin } from '@/lib/db-admin';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';

function apiOk(data: any) { return NextResponse.json(data, { status: 200 }); }
function apiErr(msg: string, status = 500) { return NextResponse.json({ error: msg }, { status }); }

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — require admin role
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    // Rate limit: 5 req/min per admin user
    const rl = await checkRateLimit('gdpr-export', authedUser.uid, 5);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 2. Get userId from request body
    const body = await req.json();
    const userId = body?.userId as string;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return apiErr('userId is required', 400);
    }

    // 3. Collect all user data from Firestore

    // --- Member profile ---
    const memberSnap = await adminDb.doc(`orgs/${ORG}/members/${userId}`).get();
    const profile = memberSnap.exists ? { id: memberSnap.id, ...memberSnap.data() } : null;

    // --- Tasks assigned to user ---
    const tasksAssignedSnap = await adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where('assignees', 'array-contains', userId)
      .get();
    const tasksAssigned = tasksAssignedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // --- Tasks created by user ---
    const tasksCreatedSnap = await adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where('createdBy', '==', userId)
      .get();
    const tasksCreated = tasksCreatedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // --- Goals owned by user ---
    const goalsSnap = await adminDb.collection('goals')
      .where('orgId', '==', ORG)
      .where('ownerId', '==', userId)
      .get();
    const goals = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // --- Documents created by user ---
    const docsSnap = await adminDb.collection('documents')
      .where('orgId', '==', ORG)
      .where('createdBy', '==', userId)
      .get();
    const documents = docsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // --- Time entries by user ---
    const timeEntriesSnap = await adminDb.collection('time-entries')
      .where('orgId', '==', ORG)
      .where('userId', '==', userId)
      .get();
    const timeEntries = timeEntriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // --- Chat messages by user (across all channels) ---
    const channelsSnap = await adminDb.collection('channels')
      .where('orgId', '==', ORG)
      .get();
    const chatMessages: any[] = [];
    for (const channelDoc of channelsSnap.docs) {
      const messagesSnap = await adminDb
        .collection(`channels/${channelDoc.id}/messages`)
        .where('userId', '==', userId)
        .get();
      for (const msgDoc of messagesSnap.docs) {
        chatMessages.push({
          id: msgDoc.id,
          channelId: channelDoc.id,
          ...msgDoc.data(),
        });
      }
    }

    // --- Form submissions by user ---
    // Form submissions are subcollections under forms/{formId}/submissions.
    // We need to query all forms for this org, then check their submissions.
    const formsSnap = await adminDb.collection('forms')
      .where('orgId', '==', ORG)
      .get();
    const formSubmissions: any[] = [];
    for (const formDoc of formsSnap.docs) {
      const subsSnap = await adminDb
        .collection(`forms/${formDoc.id}/submissions`)
        .where('createdBy', '==', userId)
        .get();
      for (const subDoc of subsSnap.docs) {
        formSubmissions.push({
          id: subDoc.id,
          formId: formDoc.id,
          ...subDoc.data(),
        });
      }
    }

    // --- Notifications for user ---
    const notificationsSnap = await adminDb
      .collection(`orgs/${ORG}/notifications`)
      .where('userId', '==', userId)
      .get();
    const notifications = notificationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // --- Audit logs by user ---
    const auditLogsSnap = await adminDb.collection('auditLogs')
      .where('orgId', '==', ORG)
      .where('actorId', '==', userId)
      .get();
    const auditLogs = auditLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Log the export action
    await logActionAdmin({
      action: 'gdpr_data_export',
      resource: `user/${userId}`,
      detail: `GDPR data export for user ${userId} requested by admin ${authedUser.uid}`,
      actorId: authedUser.uid,
      actorName: authedUser.email || authedUser.uid,
    });

    // 5. Return all sections
    return apiOk({
      exportedAt: new Date().toISOString(),
      userId,
      requestedBy: authedUser.uid,
      data: {
        profile,
        tasksAssigned,
        tasksCreated,
        goals,
        documents,
        timeEntries,
        chatMessages,
        formSubmissions,
        notifications,
        auditLogs,
      },
      counts: {
        profile: profile ? 1 : 0,
        tasksAssigned: tasksAssigned.length,
        tasksCreated: tasksCreated.length,
        goals: goals.length,
        documents: documents.length,
        timeEntries: timeEntries.length,
        chatMessages: chatMessages.length,
        formSubmissions: formSubmissions.length,
        notifications: notifications.length,
        auditLogs: auditLogs.length,
      },
    });
  } catch (err) {
    console.error('[GDPR-Export] operation failed:', err);
    return apiErr('Internal error', 500);
  }
}
