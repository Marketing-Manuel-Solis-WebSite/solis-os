import { NextRequest, NextResponse } from 'next/server';
import { generateWebhookSecret } from '@/lib/integrations-crypto';
import { addWebhook } from '@/lib/integrations-db';
import type { WebhookEvent } from '@/lib/integrations-types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, url, events, createdBy } = body as {
      name: string;
      url: string;
      events: WebhookEvent[];
      createdBy: string;
    };

    if (!name?.trim() || !url?.trim() || !events?.length) {
      return NextResponse.json({ error: 'Name, url, and events required' }, { status: 400 });
    }

    const secret = generateWebhookSecret();

    const ref = await addWebhook({
      name: name.trim(),
      url: url.trim(),
      events,
      secret,
      createdBy: createdBy || '',
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
