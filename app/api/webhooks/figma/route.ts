import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    // Figma webhook passcode verification
    const passcode = process.env.FIGMA_WEBHOOK_PASSCODE;
    if (passcode) {
      const headerPasscode = req.headers.get('x-figma-passcode') || '';
      if (headerPasscode && headerPasscode !== passcode) {
        return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
      }
    }

    const bodyText = await req.text();
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
