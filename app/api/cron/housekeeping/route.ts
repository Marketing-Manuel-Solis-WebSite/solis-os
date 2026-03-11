// ============================================================
// Cron: Housekeeping — daily cleanup of stale data
// ============================================================
// Runs daily at 3:00 AM UTC. Cleans up:
//   1. Old / read notifications
//   2. Old event logs
//   3. Processed webhook events
//   4. Stale presence docs
//   5. Done / archived inbox items
//   6. Excess automation logs (keep latest 500)
//   7. Soft-deleted tasks (+ subcollections)
//   8. Un-freeze snoozed inbox items
//   9. Form submission retention enforcement
//
// Auth: CRON_SECRET Bearer token (same as other cron routes).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const ORG = 'solis-center';
const BATCH_LIMIT = 450;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Delete docs in batches of BATCH_LIMIT. Returns count deleted. */
async function batchDelete(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

/** Delete all docs in a subcollection (batched). */
async function deleteSubcollection(
  parentPath: string,
  sub: string,
): Promise<number> {
  const snap = await adminDb.collection(`${parentPath}/${sub}`).limit(5000).get();
  if (snap.empty) return 0;
  return batchDelete(snap.docs);
}

function daysAgo(days: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return Timestamp.fromDate(d);
}

function minutesAgo(minutes: number): Timestamp {
  const d = new Date();
  d.setTime(d.getTime() - minutes * 60_000);
  return Timestamp.fromDate(d);
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Auth: verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats: Record<string, number | string> = {};

  // -----------------------------------------------------------------------
  // (a) Notifications cleanup
  // -----------------------------------------------------------------------
  try {
    const notifCol = `orgs/${ORG}/notifications`;

    // Read notifications older than 30 days
    const readOldSnap = await adminDb
      .collection(notifCol)
      .where('read', '==', true)
      .where('createdAt', '<', daysAgo(30))
      .limit(500)
      .get();

    // All notifications older than 90 days
    const veryOldSnap = await adminDb
      .collection(notifCol)
      .where('createdAt', '<', daysAgo(90))
      .limit(500)
      .get();

    // Merge unique doc refs
    const seen = new Set<string>();
    const toDelete: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const d of [...readOldSnap.docs, ...veryOldSnap.docs]) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        toDelete.push(d);
      }
    }

    stats.notifications = await batchDelete(toDelete);
  } catch (err: any) {
    console.error('[Housekeeping] notifications cleanup failed:', err);
    stats.notifications = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (b) EventLogs cleanup — older than 90 days
  // -----------------------------------------------------------------------
  try {
    const snap = await adminDb
      .collection(`orgs/${ORG}/eventLogs`)
      .where('createdAt', '<', daysAgo(90))
      .limit(500)
      .get();
    stats.eventLogs = await batchDelete(snap.docs);
  } catch (err: any) {
    console.error('[Housekeeping] eventLogs cleanup failed:', err);
    stats.eventLogs = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (c) WebhookEvents cleanup — processed/exhausted older than 7 days
  // -----------------------------------------------------------------------
  try {
    const cutoff = daysAgo(7);
    let totalDeleted = 0;

    // processed + processedAt older than 7 days
    const processedSnap = await adminDb
      .collection('webhookEvents')
      .where('status', '==', 'processed')
      .where('processedAt', '<', cutoff)
      .limit(500)
      .get();
    totalDeleted += await batchDelete(processedSnap.docs);

    // exhausted + updatedAt older than 7 days
    const exhaustedSnap = await adminDb
      .collection('webhookEvents')
      .where('status', '==', 'exhausted')
      .where('updatedAt', '<', cutoff)
      .limit(500)
      .get();
    totalDeleted += await batchDelete(exhaustedSnap.docs);

    stats.webhookEvents = totalDeleted;
  } catch (err: any) {
    console.error('[Housekeeping] webhookEvents cleanup failed:', err);
    stats.webhookEvents = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (d) Presence cleanup — lastSeen older than 5 minutes
  // -----------------------------------------------------------------------
  try {
    const snap = await adminDb
      .collection(`orgs/${ORG}/presence`)
      .where('lastSeen', '<', minutesAgo(5))
      .limit(500)
      .get();
    stats.presence = await batchDelete(snap.docs);
  } catch (err: any) {
    console.error('[Housekeeping] presence cleanup failed:', err);
    stats.presence = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (e) Inbox cleanup — done/archived older than 30 days
  // -----------------------------------------------------------------------
  try {
    const inboxCol = `orgs/${ORG}/inbox`;
    const cutoff = daysAgo(30);
    let totalDeleted = 0;

    const doneSnap = await adminDb
      .collection(inboxCol)
      .where('status', '==', 'done')
      .where('updatedAt', '<', cutoff)
      .limit(500)
      .get();
    totalDeleted += await batchDelete(doneSnap.docs);

    const archivedSnap = await adminDb
      .collection(inboxCol)
      .where('status', '==', 'archived')
      .where('updatedAt', '<', cutoff)
      .limit(500)
      .get();
    totalDeleted += await batchDelete(archivedSnap.docs);

    stats.inbox = totalDeleted;
  } catch (err: any) {
    console.error('[Housekeeping] inbox cleanup failed:', err);
    stats.inbox = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (f) Automation logs cleanup — keep latest 500 per automation
  // -----------------------------------------------------------------------
  try {
    let totalDeleted = 0;
    const autoSnap = await adminDb
      .collection('automations')
      .where('orgId', '==', ORG)
      .limit(200)
      .get();

    for (const autoDoc of autoSnap.docs) {
      try {
        const logsSnap = await adminDb
          .collection(`automations/${autoDoc.id}/logs`)
          .orderBy('createdAt', 'desc')
          .offset(500)
          .limit(500)
          .get();

        if (!logsSnap.empty) {
          totalDeleted += await batchDelete(logsSnap.docs);
        }
      } catch (innerErr: any) {
        console.error(`[Housekeeping] automation logs cleanup failed for ${autoDoc.id}:`, innerErr);
      }
    }
    stats.automationLogs = totalDeleted;
  } catch (err: any) {
    console.error('[Housekeeping] automation logs cleanup failed:', err);
    stats.automationLogs = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (g) Soft-deleted tasks cleanup — deleted > 90 days, cascade subs
  // -----------------------------------------------------------------------
  try {
    let totalDeleted = 0;
    const snap = await adminDb
      .collection('tasks')
      .where('deleted', '==', true)
      .where('deletedAt', '<', daysAgo(90))
      .limit(200)
      .get();

    for (const doc of snap.docs) {
      try {
        await deleteSubcollection(`tasks/${doc.id}`, 'comments').catch(() => {});
        await deleteSubcollection(`tasks/${doc.id}`, 'activity').catch(() => {});

        const batch = adminDb.batch();
        batch.delete(doc.ref);
        await batch.commit();
        totalDeleted++;
      } catch (innerErr: any) {
        console.error(`[Housekeeping] soft-deleted task cleanup failed for ${doc.id}:`, innerErr);
      }
    }
    stats.softDeletedTasks = totalDeleted;
  } catch (err: any) {
    console.error('[Housekeeping] soft-deleted tasks cleanup failed:', err);
    stats.softDeletedTasks = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (h) Inbox snooze un-freeze — re-open snoozed items past their time
  // -----------------------------------------------------------------------
  try {
    const now = Timestamp.now();
    const snap = await adminDb
      .collection(`orgs/${ORG}/inbox`)
      .where('status', '==', 'snoozed')
      .where('snoozedUntil', '<', now)
      .limit(500)
      .get();

    let updated = 0;
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
      chunk.forEach((d) => batch.update(d.ref, { status: 'pending' }));
      await batch.commit();
      updated += chunk.length;
    }
    stats.inboxUnfreeze = updated;
  } catch (err: any) {
    console.error('[Housekeeping] inbox snooze un-freeze failed:', err);
    stats.inboxUnfreeze = `error: ${err?.message}`;
  }

  // -----------------------------------------------------------------------
  // (i) Form retention enforcement
  // -----------------------------------------------------------------------
  try {
    let totalDeleted = 0;
    const formsSnap = await adminDb
      .collection('forms')
      .where('orgId', '==', ORG)
      .limit(200)
      .get();

    for (const formDoc of formsSnap.docs) {
      try {
        const data = formDoc.data();
        const retentionDays = data.retentionDays;
        if (!retentionDays || retentionDays <= 0) continue;

        const cutoff = daysAgo(retentionDays);
        const subsSnap = await adminDb
          .collection(`forms/${formDoc.id}/submissions`)
          .where('createdAt', '<', cutoff)
          .limit(500)
          .get();

        if (!subsSnap.empty) {
          totalDeleted += await batchDelete(subsSnap.docs);
        }
      } catch (innerErr: any) {
        console.error(`[Housekeeping] form retention failed for ${formDoc.id}:`, innerErr);
      }
    }
    stats.formRetention = totalDeleted;
  } catch (err: any) {
    console.error('[Housekeeping] form retention enforcement failed:', err);
    stats.formRetention = `error: ${err?.message}`;
  }

  return NextResponse.json({ ok: true, stats });
}
