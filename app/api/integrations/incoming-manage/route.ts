import { NextRequest, NextResponse } from 'next/server';
import { generateWebhookSecret, generateEndpointToken } from '@/lib/integrations-crypto';
import { addIncomingWebhook } from '@/lib/integrations-db-admin';
import { authenticateAdmin } from '@/lib/server-auth';
import { IncomingWebhookCreateSchema, formatZodError } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const authedUser = await authenticateAdmin(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized – admin role required' }, { status: 403 });
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
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
