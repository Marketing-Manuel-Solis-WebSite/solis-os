// ================================================================
// Backfill script: Add titleLower field to existing documents
// ================================================================
// Run with: npx tsx scripts/backfill-title-lower.ts
//
// Processes tasks, documents (docs), goals, and channels in batches
// of 450 (Firestore batch write limit). Idempotent — safe to re-run.
// ================================================================

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already done
if (getApps().length === 0) {
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp();
  }
}

const db = getFirestore();
const BATCH_LIMIT = 450;
const ORG = process.env.ORG_ID || 'solis-law';

interface BackfillConfig {
  collection: string;
  titleField: string;
  lowerField: string;
  orgScoped: boolean;
}

const CONFIGS: BackfillConfig[] = [
  { collection: 'tasks', titleField: 'title', lowerField: 'titleLower', orgScoped: true },
  { collection: 'documents', titleField: 'title', lowerField: 'titleLower', orgScoped: true },
  { collection: 'goals', titleField: 'name', lowerField: 'titleLower', orgScoped: true },
  { collection: 'channels', titleField: 'name', lowerField: 'nameLower', orgScoped: true },
];

async function backfillCollection(config: BackfillConfig): Promise<number> {
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  console.log(`\nBackfilling ${config.collection}...`);

  while (true) {
    let q: FirebaseFirestore.Query = db.collection(config.collection);
    if (config.orgScoped) q = q.where('orgId', '==', ORG);
    q = q.orderBy('__name__').limit(1000);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    // Filter docs that need updating
    const needsUpdate = snap.docs.filter(d => {
      const data = d.data();
      const title = data[config.titleField] || '';
      const existing = data[config.lowerField];
      return existing !== title.toLowerCase();
    });

    // Batch write
    for (let i = 0; i < needsUpdate.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = needsUpdate.slice(i, i + BATCH_LIMIT);
      for (const docSnap of chunk) {
        const title = docSnap.data()[config.titleField] || '';
        batch.update(docSnap.ref, { [config.lowerField]: title.toLowerCase() });
      }
      await batch.commit();
      updated += chunk.length;
    }

    console.log(`  Processed ${snap.docs.length} docs, updated ${needsUpdate.length}`);

    if (snap.docs.length < 1000) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`  Total updated in ${config.collection}: ${updated}`);
  return updated;
}

async function main() {
  console.log('=== Backfill titleLower/nameLower fields ===');
  console.log(`ORG: ${ORG}`);

  let totalUpdated = 0;
  for (const config of CONFIGS) {
    totalUpdated += await backfillCollection(config);
  }

  console.log(`\n=== Done! Total documents updated: ${totalUpdated} ===`);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
