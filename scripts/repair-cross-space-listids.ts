/**
 * Data Repair Script: Fix legacy tasks with cross-space listId
 *
 * Finds tasks where task.listId points to a list in a different space than task.teamId.
 * Sets those listId fields to null (Unsorted).
 *
 * Usage:
 *   npx tsx scripts/repair-cross-space-listids.ts [--dry-run]
 *
 * Requires FIREBASE_ADMIN_KEY env var or service account in the standard path.
 */

import * as admin from 'firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';

const DRY_RUN = process.argv.includes('--dry-run');


// Initialize admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

async function run() {
  console.log(`\n=== Cross-Space listId Repair ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`);

  // 1. Build a Map of listId -> spaceId from all lists
  const listsSnap = await db.collection('lists').where('orgId', '==', ORG).get();
  const listSpaceMap = new Map<string, string>();
  for (const doc of listsSnap.docs) {
    listSpaceMap.set(doc.id, doc.data().spaceId || '');
  }
  console.log(`Loaded ${listSpaceMap.size} lists.`);

  // 2. Query all tasks with non-null listId
  const tasksSnap = await db.collection('tasks')
    .where('orgId', '==', ORG)
    .where('listId', '!=', null)
    .get();

  console.log(`Found ${tasksSnap.size} tasks with listId set.\n`);

  let violationCount = 0;
  let orphanCount = 0;
  const repairs: { taskId: string; teamId: string; listId: string; listSpaceId: string | null; reason: string }[] = [];

  for (const doc of tasksSnap.docs) {
    const data = doc.data();
    const taskTeamId = data.teamId || '';
    const listId = data.listId;

    if (!listId) continue;

    const listSpaceId = listSpaceMap.get(listId);

    if (listSpaceId === undefined) {
      // List doesn't exist at all — orphaned reference
      orphanCount++;
      repairs.push({ taskId: doc.id, teamId: taskTeamId, listId, listSpaceId: null, reason: 'LIST_NOT_FOUND' });
    } else if (listSpaceId !== taskTeamId) {
      // Cross-space violation
      violationCount++;
      repairs.push({ taskId: doc.id, teamId: taskTeamId, listId, listSpaceId, reason: 'CROSS_SPACE' });
    }
  }

  console.log(`Cross-space violations: ${violationCount}`);
  console.log(`Orphaned listId refs:   ${orphanCount}`);
  console.log(`Total repairs needed:   ${repairs.length}\n`);

  if (repairs.length === 0) {
    console.log('No repairs needed. Data is clean.');
    return;
  }

  // Print details
  for (const r of repairs) {
    console.log(`  [${r.reason}] task=${r.taskId} teamId=${r.teamId} listId=${r.listId} listSpaceId=${r.listSpaceId}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run — no changes made. Remove --dry-run to apply.');
    return;
  }

  // 3. Apply repairs in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < repairs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = repairs.slice(i, i + BATCH_SIZE);
    for (const r of chunk) {
      batch.update(db.collection('tasks').doc(r.taskId), { listId: null });
    }
    await batch.commit();
    console.log(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} tasks)`);
  }

  console.log(`\nDone. ${repairs.length} tasks repaired (listId set to null).`);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
