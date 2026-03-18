// ================================================================
// Next.js Middleware — IP Allowlist enforcement
// ================================================================
// Checks incoming requests against the org's IP allowlist.
// Only applies to /app/* and /api/* routes (not public pages).
// The allowlist is cached and refreshed periodically.

import { NextResponse, type NextRequest } from 'next/server';

// ---- Security Headers ----
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.sentry.io",
    "frame-ancestors 'none'",
  ].join('; '),
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// IP allowlist cache — refreshed every 5 minutes
let cachedAllowlist: { enabled: boolean; ranges: string[] } | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Simple CIDR matching (same logic as lib/security/ip-allowlist.ts but
 * duplicated here because middleware runs in Edge Runtime where we can't
 * import server modules).
 */
function ipToNumber(ip: string): number | null {
  const clean = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const parts = clean.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) | octet;
  }
  return num >>> 0;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  try {
    const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    const cleanCidr = cidr.startsWith('::ffff:') ? cidr.slice(7) : cidr;
    const [rangeIp, maskBits] = cleanCidr.split('/');
    const mask = maskBits !== undefined ? parseInt(maskBits, 10) : 32;
    if (mask < 0 || mask > 32) return false;
    const ipNum = ipToNumber(cleanIp);
    const rangeNum = ipToNumber(rangeIp);
    if (ipNum === null || rangeNum === null) return false;
    const bitmask = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
    return (ipNum & bitmask) === (rangeNum & bitmask);
  } catch {
    return false;
  }
}

function isIpAllowed(ip: string, config: { enabled: boolean; ranges: string[] }): boolean {
  if (!config.enabled) return true;
  if (config.ranges.length === 0) return true;
  for (const range of config.ranges) {
    if (ipMatchesCidr(ip, range)) return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only enforce on app and API routes
  if (!pathname.startsWith('/app') && !pathname.startsWith('/api')) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Skip health check and public endpoints
  if (pathname === '/api/health' || pathname.startsWith('/api/docs/public') || pathname.startsWith('/shared/')) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Get client IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';

  // Load allowlist from cache or Firestore
  if (!cachedAllowlist || Date.now() > cacheExpiry) {
    try {
      // In Edge Runtime, we call an internal API to get the config
      // This avoids importing firebase-admin in middleware
      const configUrl = new URL('/api/security/ip-config', request.url);
      const internalKey = process.env.INTERNAL_API_KEY;
      if (!internalKey) {
        // No internal key configured — IP allowlist disabled (safe default)
        cachedAllowlist = { enabled: false, ranges: [] };
        cacheExpiry = Date.now() + CACHE_TTL_MS;
      } else {
        const res = await fetch(configUrl.toString(), {
          headers: { 'x-internal-key': internalKey },
        });
        if (res.ok) {
          cachedAllowlist = await res.json();
        } else if (cachedAllowlist) {
          // Config fetch failed but we have cached data — use stale cache
          console.warn('[Middleware] IP config fetch failed, using stale cache');
        } else {
          // No cache and fetch failed — disable allowlist to avoid lockout on first deploy
          cachedAllowlist = { enabled: false, ranges: [] };
        }
        cacheExpiry = Date.now() + CACHE_TTL_MS;
      }
    } catch {
      // On error: use cached data if available, otherwise disable allowlist
      if (!cachedAllowlist) {
        cachedAllowlist = { enabled: false, ranges: [] };
      }
    }
  }

  if (cachedAllowlist && !isIpAllowed(ip, cachedAllowlist)) {
    const denied = new NextResponse(
      JSON.stringify({ error: 'Access denied: IP not in allowlist' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
    return applySecurityHeaders(denied);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
};
