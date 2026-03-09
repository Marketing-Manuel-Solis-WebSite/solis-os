import { NextRequest, NextResponse } from 'next/server';
import { updateWebhook, deleteWebhook } from '@/lib/integrations-db-admin';
import { requireAdmin } from '@/lib/server-auth';
import { WebhookUpdateSchema, formatZodError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    const rl = checkRateLimit('integrations', authedUser.uid, 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = WebhookUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error) }, { status: 400 });
    }

    await updateWebhook(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Webhooks] webhook update failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    const rl = checkRateLimit('integrations', authedUser.uid, 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { id } = await params;
    await deleteWebhook(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Webhooks] webhook deletion failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
