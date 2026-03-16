// ================================================================
// AI Usage Tracking, Rate Limiting & Cost Controls
// ================================================================

import {
  collection, doc, getDoc, setDoc, getDocs, addDoc, query, where, orderBy, limit,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';


const USAGE_COL = `orgs/${ORG}/ai-usage`;
const LOG_COL = `orgs/${ORG}/ai-logs`;

// ================================================================
// ROLE-BASED LIMITS (requests per day)
// ================================================================

const DAILY_LIMITS: Record<string, number> = {
  admin: 100,
  manager: 60,
  member: 30,
  viewer: 10,
};

const MODE_COSTS: Record<string, number> = {
  chat: 1,      // 1 unit
  research: 3,  // 3 units (longer, more tokens)
  deep: 8,      // 8 units (very long, expensive)
};

export function getDailyLimit(role: string): number {
  return DAILY_LIMITS[role] || DAILY_LIMITS.member;
}

// ================================================================
// CHECK & INCREMENT USAGE
// ================================================================

function todayKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export async function checkAIUsage(userId: string, role: string, mode: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const dayKey = todayKey();
  const ref = doc(db, USAGE_COL, `${userId}_${dayKey}`);
  const snap = await getDoc(ref);
  const data = snap.data();

  const used = data?.units || 0;
  const dailyLimit = getDailyLimit(role);
  const cost = MODE_COSTS[mode] || 1;
  const remaining = Math.max(0, dailyLimit - used);

  return {
    allowed: used + cost <= dailyLimit,
    used,
    limit: dailyLimit,
    remaining,
  };
}

export async function incrementAIUsage(userId: string, mode: string, tokensUsed: number): Promise<void> {
  const dayKey = todayKey();
  const ref = doc(db, USAGE_COL, `${userId}_${dayKey}`);
  const snap = await getDoc(ref);

  const cost = MODE_COSTS[mode] || 1;

  if (snap.exists()) {
    await setDoc(ref, {
      units: increment(cost),
      tokens: increment(tokensUsed),
      requests: increment(1),
      lastRequestAt: serverTimestamp(),
    }, { merge: true });
  } else {
    await setDoc(ref, {
      userId,
      date: dayKey,
      units: cost,
      tokens: tokensUsed,
      requests: 1,
      createdAt: serverTimestamp(),
      lastRequestAt: serverTimestamp(),
    });
  }
}

// ================================================================
// AI ACTION LOGGING
// ================================================================

export interface AILogEntry {
  userId: string;
  userName: string;
  feature: string;     // 'chat' | 'analytics' | 'docs' | 'dashboard' | 'floating'
  mode: string;        // 'chat' | 'research' | 'deep'
  questionLength: number;
  contextLength: number;
  responseLength: number;
  truncated: boolean;
  durationMs: number;
  success: boolean;
  error?: string;
  estimatedTokens: number;
  timestamp: any;
}

export async function logAIAction(entry: Omit<AILogEntry, 'timestamp'>): Promise<void> {
  try {
    await addDoc(collection(db, LOG_COL), {
      ...entry,
      timestamp: serverTimestamp(),
    });
  } catch {
    // Logging failures should not break the AI flow
  }
}

// ================================================================
// USAGE STATS (for admin dashboard)
// ================================================================

export async function getAIUsageStats(userId?: string): Promise<{
  todayUnits: number;
  todayRequests: number;
  todayTokens: number;
}> {
  const dayKey = todayKey();

  if (userId) {
    const ref = doc(db, USAGE_COL, `${userId}_${dayKey}`);
    const snap = await getDoc(ref);
    const data = snap.data();
    return {
      todayUnits: data?.units || 0,
      todayRequests: data?.requests || 0,
      todayTokens: data?.tokens || 0,
    };
  }

  // Org-wide: query all docs for today
  const q = query(collection(db, USAGE_COL), where('date', '==', dayKey));
  const snap = await getDocs(q);
  let units = 0, requests = 0, tokens = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    units += data.units || 0;
    requests += data.requests || 0;
    tokens += data.tokens || 0;
  });
  return { todayUnits: units, todayRequests: requests, todayTokens: tokens };
}

// ================================================================
// INPUT VALIDATION
// ================================================================

const MAX_QUESTION_LENGTH = 10_000;
const MAX_CONTEXT_LENGTH = 50_000;

export function validateAIInput(question: string, context?: string): {
  valid: boolean;
  error?: string;
  truncatedQuestion?: string;
  truncatedContext?: string;
} {
  if (!question || !question.trim()) {
    return { valid: false, error: 'Question is required' };
  }

  let truncatedQuestion = question;
  let truncatedContext = context;
  let truncated = false;

  if (question.length > MAX_QUESTION_LENGTH) {
    truncatedQuestion = question.slice(0, MAX_QUESTION_LENGTH);
    truncated = true;
  }

  if (context && context.length > MAX_CONTEXT_LENGTH) {
    truncatedContext = context.slice(0, MAX_CONTEXT_LENGTH);
    truncated = true;
  }

  return {
    valid: true,
    truncatedQuestion,
    truncatedContext,
  };
}
