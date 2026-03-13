/**
 * Data Repair Script via Firestore REST API
 * Uses the Firebase CLI stored tokens for auth.
 *
 * Usage:
 *   npx tsx scripts/repair-listids-rest.ts [--dry-run]
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DRY_RUN = process.argv.includes('--dry-run');
const PROJECT_ID = 'solis-center';
const ORG = 'solis-center';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Read Firebase CLI credentials
const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens.refresh_token;

// Firebase CLI OAuth2 client (public, same as Firebase CLI source code)
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

async function getAccessToken(): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json() as any;
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

interface FirestoreDoc {
  name: string;
  fields: Record<string, any>;
}

function getStringValue(doc: FirestoreDoc, field: string): string | null {
  const f = doc.fields?.[field];
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('nullValue' in f) return null;
  return null;
}

async function runQuery(token: string, collection: string, filters: any[]): Promise<FirestoreDoc[]> {
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: filters.map(f => ({
          fieldFilter: {
            field: { fieldPath: f.field },
            op: f.op,
            value: f.value,
          },
        })),
      },
    },
    limit: 10000,
  };

  const resp = await fetch(
    `${BASE}:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ structuredQuery }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Query failed (${resp.status}): ${text}`);
  }

  const results = await resp.json() as any[];
  const docs: FirestoreDoc[] = [];
  for (const r of results) {
    if (r.document) docs.push(r.document);
  }
  return docs;
}

async function patchDoc(token: string, fullName: string, fields: Record<string, any>): Promise<void> {
  const updateMask = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&');
  const firestoreFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = v === null ? { nullValue: null } : { stringValue: v };
  }

  const url = `https://firestore.googleapis.com/v1/${fullName}?${updateMask}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Patch failed for ${fullName}: ${text}`);
  }
}

async function run() {
  console.log(`\n=== Cross-Space listId Repair ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`);

  const token = await getAccessToken();
  console.log('Access token acquired.\n');

  // 1. Get all lists
  const lists = await runQuery(token, 'lists', [
    { field: 'orgId', op: 'EQUAL', value: { stringValue: ORG } },
  ]);
  const listSpaceMap = new Map<string, string>();
  for (const l of lists) {
    const id = l.name.split('/').pop()!;
    listSpaceMap.set(id, getStringValue(l, 'spaceId') || '');
  }
  console.log(`Loaded ${listSpaceMap.size} lists.`);

  // 2. Get all tasks with non-null listId
  const tasks = await runQuery(token, 'tasks', [
    { field: 'orgId', op: 'EQUAL', value: { stringValue: ORG } },
    { field: 'listId', op: 'NOT_EQUAL', value: { nullValue: null } },
  ]);
  console.log(`Found ${tasks.length} tasks with listId set.\n`);

  let violationCount = 0;
  let orphanCount = 0;
  const repairs: { taskId: string; fullName: string; teamId: string; listId: string; listSpaceId: string | null; reason: string }[] = [];

  for (const t of tasks) {
    const taskId = t.name.split('/').pop()!;
    const teamId = getStringValue(t, 'teamId') || '';
    const listId = getStringValue(t, 'listId');
    if (!listId) continue;

    const listSpaceId = listSpaceMap.get(listId);
    if (listSpaceId === undefined) {
      orphanCount++;
      repairs.push({ taskId, fullName: t.name, teamId, listId, listSpaceId: null, reason: 'LIST_NOT_FOUND' });
    } else if (listSpaceId !== teamId) {
      violationCount++;
      repairs.push({ taskId, fullName: t.name, teamId, listId, listSpaceId, reason: 'CROSS_SPACE' });
    }
  }

  console.log(`Cross-space violations: ${violationCount}`);
  console.log(`Orphaned listId refs:   ${orphanCount}`);
  console.log(`Total repairs needed:   ${repairs.length}\n`);

  if (repairs.length === 0) {
    console.log('✓ No repairs needed. Data is clean.');
    return;
  }

  for (const r of repairs) {
    console.log(`  [${r.reason}] task=${r.taskId} teamId=${r.teamId} listId=${r.listId} listSpaceId=${r.listSpaceId}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run — no changes made. Remove --dry-run to apply.');
    return;
  }

  // 3. Apply repairs
  let repaired = 0;
  for (const r of repairs) {
    await patchDoc(token, r.fullName, { listId: null });
    repaired++;
    console.log(`  Repaired ${repaired}/${repairs.length}: ${r.taskId}`);
  }

  console.log(`\n✓ Done. ${repaired} tasks repaired (listId set to null).`);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
