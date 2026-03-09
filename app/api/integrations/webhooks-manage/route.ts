import { NextRequest, NextResponse } from 'next/server';
import { generateWebhookSecret } from '@/lib/integrations-crypto';
import { addWebhook } from '@/lib/integrations-db-admin';
import { requireAdmin } from '@/lib/server-auth';
import { WebhookCreateSchema, formatZodError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    const rl = checkRateLimit('integrations', authedUser.uid, 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = WebhookCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error) }, { status: 400 });
    }

    const { name, url, events } = parsed.data;
    const secret = generateWebhookSecret();

    const ref = await addWebhook({
      name,
      url,
      events,
      secret,
      createdBy: authedUser.uid,
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error('[Webhooks] webhook creation failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
