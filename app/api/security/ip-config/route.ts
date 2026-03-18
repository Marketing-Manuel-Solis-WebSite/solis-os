// Internal API: returns IP allowlist config for middleware consumption
// Protected by internal API key — not meant for public access

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';

export async function GET(request: Request) {
  // Validate internal key — fail-closed if not configured
  const expectedKey = process.env.INTERNAL_API_KEY;
  const key = request.headers.get('x-internal-key');
  if (!expectedKey || !key || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snap = await adminDb.doc(`orgs/${ORG}/settings/security`).get();
    if (!snap.exists) {
      return NextResponse.json({ enabled: false, ranges: [] });
    }

    const data = snap.data();
    return NextResponse.json({
      enabled: data?.ipAllowlist?.enabled ?? false,
      ranges: data?.ipAllowlist?.ranges ?? [],
    });
  } catch {
    return NextResponse.json({ enabled: false, ranges: [] });
  }
}
