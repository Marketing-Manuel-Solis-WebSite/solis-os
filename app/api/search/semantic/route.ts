import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID } from '@/lib/org';
import {
  semanticSearch,
  taskToSearchable,
  docToSearchable,
  goalToSearchable,
  channelToSearchable,
  type SearchableEntity,
} from '@/lib/semantic-search';

const MAX_ENTITIES_PER_TYPE = 200;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, types } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI search not configured' }, { status: 503 });
    }

    // Determine which entity types to search
    const searchTypes: string[] = types || ['task', 'doc', 'goal', 'channel'];

    // Load entities from Firestore (server-side via admin SDK)
    const entities: SearchableEntity[] = [];

    const loaders = [];

    if (searchTypes.includes('task')) {
      loaders.push(
        adminDb.collection(`orgs/${ORG_ID}/tasks`)
          .where('deleted', '!=', true)
          .orderBy('updatedAt', 'desc')
          .limit(MAX_ENTITIES_PER_TYPE)
          .get()
          .then(snap => {
            snap.forEach(doc => {
              entities.push(taskToSearchable({ id: doc.id, ...doc.data() }));
            });
          })
          .catch(() => {}) // graceful fallback if collection doesn't exist
      );
    }

    if (searchTypes.includes('doc')) {
      loaders.push(
        adminDb.collection(`orgs/${ORG_ID}/docs`)
          .orderBy('updatedAt', 'desc')
          .limit(MAX_ENTITIES_PER_TYPE)
          .get()
          .then(snap => {
            snap.forEach(doc => {
              entities.push(docToSearchable({ id: doc.id, ...doc.data() }));
            });
          })
          .catch(() => {})
      );
    }

    if (searchTypes.includes('goal')) {
      loaders.push(
        adminDb.collection(`orgs/${ORG_ID}/goals`)
          .orderBy('updatedAt', 'desc')
          .limit(MAX_ENTITIES_PER_TYPE)
          .get()
          .then(snap => {
            snap.forEach(doc => {
              entities.push(goalToSearchable({ id: doc.id, ...doc.data() }));
            });
          })
          .catch(() => {})
      );
    }

    if (searchTypes.includes('channel')) {
      loaders.push(
        adminDb.collection(`orgs/${ORG_ID}/channels`)
          .limit(MAX_ENTITIES_PER_TYPE)
          .get()
          .then(snap => {
            snap.forEach(doc => {
              entities.push(channelToSearchable({ id: doc.id, ...doc.data() }));
            });
          })
          .catch(() => {})
      );
    }

    await Promise.all(loaders);

    if (entities.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Run semantic search
    const results = await semanticSearch(query.trim(), entities, apiKey);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('[Semantic Search]', error);
    return NextResponse.json(
      { error: 'Search failed', message: error.message },
      { status: 500 },
    );
  }
}
