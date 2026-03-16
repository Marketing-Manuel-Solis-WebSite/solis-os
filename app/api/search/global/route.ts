// ================================================================
// GET /api/search/global — Server-side global prefix search
// ================================================================
// Uses Firestore prefix matching on titleLower field.
// Returns max 5 results per entity type. No documents loaded to
// client memory for scoring — all done server-side.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_TYPE = 5;

interface SearchHit {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

async function prefixSearch(
  collectionName: string,
  type: string,
  queryLower: string,
  titleField: string,
  hrefFn: (id: string) => string,
  subtitleField: string,
): Promise<SearchHit[]> {
  const lowerField = titleField === 'name' ? 'titleLower' : 'titleLower';

  const snap = await adminDb.collection(collectionName)
    .where('orgId', '==', ORG)
    .where(lowerField, '>=', queryLower)
    .where(lowerField, '<=', queryLower + '\uf8ff')
    .limit(MAX_PER_TYPE)
    .get();

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type,
      title: data[titleField] || data.title || data.name || '',
      subtitle: data[subtitleField] || '',
      href: hrefFn(d.id),
    };
  });
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const queryLower = q.toLowerCase();

  try {
    const [tasks, docs, goals, channels] = await Promise.all([
      prefixSearch('tasks', 'task', queryLower, 'title', id => `/app/tasks?task=${id}`, 'status'),
      prefixSearch('documents', 'doc', queryLower, 'title', id => `/app/docs?doc=${id}`, 'category').catch(() => []),
      prefixSearch('goals', 'goal', queryLower, 'name', id => `/app/goals?goal=${id}`, 'status'),
      // Channels use 'name' field — search on nameLower
      adminDb.collection('channels')
        .where('orgId', '==', ORG)
        .where('nameLower', '>=', queryLower)
        .where('nameLower', '<=', queryLower + '\uf8ff')
        .limit(MAX_PER_TYPE)
        .get()
        .then(snap => snap.docs.map(d => ({
          id: d.id,
          type: 'channel' as const,
          title: d.data().name || '',
          subtitle: d.data().privacy || '',
          href: `/app/chat?channel=${d.id}`,
        })))
        .catch(() => [] as SearchHit[]),
    ]);

    // Also search members (small collection, no titleLower needed)
    let members: SearchHit[] = [];
    try {
      const memSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
      members = memSnap.docs
        .filter(d => {
          const data = d.data();
          const name = (data.displayName || '').toLowerCase();
          const email = (data.email || '').toLowerCase();
          return name.includes(queryLower) || email.includes(queryLower);
        })
        .slice(0, MAX_PER_TYPE)
        .map(d => ({
          id: d.id,
          type: 'member',
          title: d.data().displayName || d.data().email || '',
          subtitle: d.data().title || d.data().role || '',
          href: '/app/org-chart',
        }));
    } catch {}

    return NextResponse.json({
      results: [...tasks, ...docs, ...goals, ...channels, ...members],
    });
  } catch (err: any) {
    console.error('[API:search/global] error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
