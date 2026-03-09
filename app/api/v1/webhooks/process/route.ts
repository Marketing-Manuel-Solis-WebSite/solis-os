import { NextRequest, NextResponse } from 'next/server';
import { processEventQueue } from '@/lib/event-dispatcher';

export async function POST(req: NextRequest) {
  try {
    // Authenticate with WEBHOOK_PROCESSOR_SECRET
    const authHeader = req.headers.get('authorization') || '';
    const secret = process.env.WEBHOOK_PROCESSOR_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'WEBHOOK_PROCESSOR_SECRET not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processEventQueue();

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
