import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/integrations-db-admin';
import type { ApiKeyScope } from '@/lib/integrations-types';

// ============================================
// IN-MEMORY RATE LIMITER (100 req/min per key)
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;

function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 300000);

// ============================================
// API KEY VALIDATION
// ============================================
export interface ApiContext {
  keyRecord: any;
  orgId: string;
}

export async function validateApiRequest(
  req: NextRequest,
  requiredScope: ApiKeyScope,
): Promise<{ valid: boolean; context?: ApiContext; error?: NextResponse }> {
  // Extract Bearer token
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Bearer sk_live_...' },
        { status: 401 },
      ),
    };
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith('sk_live_')) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 401 },
      ),
    };
  }

  // Validate key against Firestore
  const { valid, record } = await validateApiKey(rawKey);
  if (!valid || !record) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 },
      ),
    };
  }

  // Check scope
  if (!record.scopes?.includes(requiredScope)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: `Insufficient scope. Required: ${requiredScope}` },
        { status: 403 },
      ),
    };
  }

  // Rate limit
  if (!checkRateLimit(record.id)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Rate limit exceeded. Max 100 requests per minute.' },
        { status: 429 },
      ),
    };
  }

  return {
    valid: true,
    context: { keyRecord: record, orgId: record.orgId },
  };
}

// ============================================
// RESPONSE HELPERS
// ============================================
export function apiResponse(data: any, meta?: { total?: number; limit?: number; offset?: number; hasMore?: boolean; nextCursor?: string | null }) {
  return NextResponse.json({
    data,
    meta: meta || null,
    error: null,
  });
}

export function apiError(message: string, status: number) {
  return NextResponse.json(
    { data: null, meta: null, error: message },
    { status },
  );
}

export function parsePagination(req: NextRequest): { limit: number; offset: number; cursor: string | null } {
  const url = new URL(req.url);
  const lim = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const off = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
  const cursor = url.searchParams.get('cursor') || null;
  return { limit: lim, offset: off, cursor };
}
