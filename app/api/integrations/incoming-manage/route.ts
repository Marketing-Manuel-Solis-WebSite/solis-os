import { NextRequest, NextResponse } from 'next/server';
import { generateWebhookSecret, generateEndpointToken } from '@/lib/integrations-crypto';
import { addIncomingWebhook } from '@/lib/integrations-db-admin';
import { requireAdmin } from '@/lib/server-auth';
import { IncomingWebhookCreateSchema, formatZodError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    const rl = await checkRateLimit('integrations', authedUser.uid, 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = IncomingWebhookCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error) }, { status: 400 });
    }

    const { name, provider, actionType, actionConfig } = parsed.data;
    const token = generateEndpointToken();
    const secret = generateWebhookSecret();

    const ref = await addIncomingWebhook({
      name,
      provider,
      token,
      secret,
      actionType,
      actionConfig,
      createdBy: authedUser.uid,
    });

    return NextResponse.json({ ok: true, id: ref.id, token });
  } catch (err) {
    console.error('[Integrations] incoming webhook creation failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
