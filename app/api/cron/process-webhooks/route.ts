import { NextRequest, NextResponse } from 'next/server';
import { processEventQueue } from '@/lib/event-dispatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret to prevent unauthorized invocations
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processEventQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[Cron/ProcessWebhooks] failed:', err);
    return NextResponse.json({ error: 'Processing failed', message: err?.message }, { status: 500 });
  }
}
