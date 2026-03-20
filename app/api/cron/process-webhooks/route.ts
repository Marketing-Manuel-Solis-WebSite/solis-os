import { NextRequest, NextResponse } from 'next/server';
import { processEventQueue } from '@/lib/event-dispatcher';
import { logActionAdmin } from '@/lib/db-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // FAIL-CLOSED: always require CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processEventQueue();

    await logActionAdmin({
      action: 'cron_process_events',
      resource: 'webhookEvents',
      detail: `Processed event queue: ${JSON.stringify(result)}`,
      actorId: 'system',
      actorName: 'Cron: process-webhooks',
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[Cron/ProcessWebhooks] failed:', err);
    return NextResponse.json({ error: 'Processing failed', message: err?.message }, { status: 500 });
  }
}
