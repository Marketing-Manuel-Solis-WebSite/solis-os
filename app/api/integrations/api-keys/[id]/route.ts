import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/integrations-db-admin';
import { requireAdmin } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    const rl = await checkRateLimit('integrations', authedUser.uid, 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { id } = await params;
    await revokeApiKey(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Integrations] API key revocation failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
