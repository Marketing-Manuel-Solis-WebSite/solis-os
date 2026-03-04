import { NextRequest, NextResponse } from 'next/server';
import { generateWebhookSecret, generateEndpointToken } from '@/lib/integrations-crypto';
import { addIncomingWebhook } from '@/lib/integrations-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, provider, actionType, actionConfig, createdBy } = body as {
      name: string;
      provider: string;
      actionType: 'create_task' | 'create_notification' | 'trigger_automation';
      actionConfig: Record<string, any>;
      createdBy: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    const token = generateEndpointToken();
    const secret = generateWebhookSecret();

    const ref = await addIncomingWebhook({
      name: name.trim(),
      provider: provider?.trim() || 'custom',
      token,
      secret,
      actionType: actionType || 'create_task',
      actionConfig: actionConfig || {},
      createdBy: createdBy || '',
    });

    return NextResponse.json({ ok: true, id: ref.id, token });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
