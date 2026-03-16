// ============================================================
// Semantic Search — AI-powered search using Gemini embeddings.
//
// Uses Google's text-embedding model to generate vector
// embeddings for queries and entities, then ranks by
// cosine similarity.
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = 'text-embedding-004';
const MAX_RESULTS = 15;

// ─── Types ───────────────────────────────────────────────

export interface SemanticSearchResult {
  id: string;
  type: 'task' | 'doc' | 'goal' | 'channel';
  title: string;
  subtitle: string;
  score: number; // 0-1 cosine similarity
}

export interface SearchableEntity {
  id: string;
  type: 'task' | 'doc' | 'goal' | 'channel';
  title: string;
  content: string; // text to embed (title + description + tags etc.)
}

// ─── Embedding Generation ────────────────────────────────

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ─── Cosine Similarity ──────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

// ─── Batch Embedding ─────────────────────────────────────

async function batchEmbed(texts: string[], apiKey: string): Promise<number[][]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.batchEmbedContents({
    requests: texts.map(text => ({
      content: { role: 'user', parts: [{ text }] },
    })),
  });

  return result.embeddings.map(e => e.values);
}

// ─── Main Search Function ────────────────────────────────

/**
 * Perform semantic search across a set of entities.
 *
 * @param query - Natural language search query
 * @param entities - Array of searchable entities
 * @param apiKey - Gemini API key
 * @param minScore - Minimum cosine similarity threshold (default 0.3)
 */
export async function semanticSearch(
  query: string,
  entities: SearchableEntity[],
  apiKey: string,
  minScore = 0.3,
): Promise<SemanticSearchResult[]> {
  if (!query.trim() || entities.length === 0) return [];

  // Truncate entity content to avoid token limits (max ~512 chars each)
  const truncated = entities.map(e => ({
    ...e,
    content: e.content.slice(0, 512),
  }));

  // Batch: embed query + all entities in one call for efficiency
  const allTexts = [query, ...truncated.map(e => e.content)];

  // Gemini batch limit is 100 — split if needed
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < allTexts.length; i += BATCH_SIZE) {
    const batch = allTexts.slice(i, i + BATCH_SIZE);
    const embeddings = await batchEmbed(batch, apiKey);
    allEmbeddings.push(...embeddings);
  }

  const queryEmbedding = allEmbeddings[0];
  const entityEmbeddings = allEmbeddings.slice(1);

  // Score each entity by cosine similarity
  const scored: SemanticSearchResult[] = [];
  for (let i = 0; i < truncated.length; i++) {
    const score = cosineSimilarity(queryEmbedding, entityEmbeddings[i]);
    if (score >= minScore) {
      scored.push({
        id: truncated[i].id,
        type: truncated[i].type,
        title: truncated[i].title,
        subtitle: truncated[i].content.slice(0, 100),
        score: Math.round(score * 1000) / 1000,
      });
    }
  }

  // Sort by score descending, limit results
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS);
}

// ─── Entity Builders ─────────────────────────────────────

/** Build searchable text from a task */
export function taskToSearchable(task: any): SearchableEntity {
  const parts = [task.title || ''];
  if (task.description) parts.push(task.description);
  if (task.tags?.length) parts.push(task.tags.join(' '));
  if (task.status) parts.push(task.status);
  if (task.priority) parts.push(task.priority);
  return {
    id: task.id,
    type: 'task',
    title: task.title || 'Untitled task',
    content: parts.join(' | '),
  };
}

/** Build searchable text from a document */
export function docToSearchable(doc: any): SearchableEntity {
  const parts = [doc.title || ''];
  if (doc.content) parts.push(doc.content.slice(0, 400));
  if (doc.tags?.length) parts.push(doc.tags.join(' '));
  if (doc.category) parts.push(doc.category);
  return {
    id: doc.id,
    type: 'doc',
    title: doc.title || 'Untitled document',
    content: parts.join(' | '),
  };
}

/** Build searchable text from a goal */
export function goalToSearchable(goal: any): SearchableEntity {
  const parts = [goal.name || ''];
  if (goal.description) parts.push(goal.description);
  if (goal.tags?.length) parts.push(goal.tags.join(' '));
  if (goal.status) parts.push(goal.status);
  return {
    id: goal.id,
    type: 'goal',
    title: goal.name || 'Untitled goal',
    content: parts.join(' | '),
  };
}

/** Build searchable text from a channel */
export function channelToSearchable(channel: any): SearchableEntity {
  const parts = [channel.name || ''];
  if (channel.description) parts.push(channel.description);
  if (channel.topic) parts.push(channel.topic);
  return {
    id: channel.id,
    type: 'channel',
    title: channel.name || 'Unnamed channel',
    content: parts.join(' | '),
  };
}
