import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if passcode not configured
    const passcode = process.env.FIGMA_WEBHOOK_PASSCODE;
    if (!passcode) {
      return NextResponse.json(
        { error: 'Figma webhook passcode not configured. Contact admin.' },
        { status: 422 },
      );
    }

    // Require valid passcode (timing-safe comparison)
    const headerPasscode = req.headers.get('x-figma-passcode') || '';
    if (!headerPasscode || headerPasscode.length !== passcode.length ||
        !timingSafeEqual(Buffer.from(headerPasscode), Buffer.from(passcode))) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const eventType = payload.event_type || 'unknown';

    await queueEvent({
      eventType: 'task.updated',
      entityId: payload.file_key || '',
      entityType: `figma_${eventType}`,
      payload: {
        provider: 'figma',
        figmaEvent: eventType,
        fileKey: payload.file_key || '',
        fileName: payload.file_name || '',
        triggeredBy: payload.triggered_by?.handle || '',
        timestamp: payload.timestamp || '',
        description: payload.description || '',
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
