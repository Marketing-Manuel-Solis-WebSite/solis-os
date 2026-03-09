import { NextRequest, NextResponse } from 'next/server';
import { generateWebhookSecret } from '@/lib/integrations-crypto';
import { addWebhook } from '@/lib/integrations-db-admin';
import { authenticateAdmin } from '@/lib/server-auth';
import { WebhookCreateSchema, formatZodError } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const authedUser = await authenticateAdmin(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized – admin role required' }, { status: 403 });
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
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
