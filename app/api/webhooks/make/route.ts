import { NextRequest, NextResponse } from 'next/server';
import { processIncomingWebhook } from '@/lib/integrations-incoming-processor';
import { checkReplayProtection } from '@/lib/integrations-db-admin';
import { timingSafeEqual } from 'crypto';

const MAX_PAYLOAD = 1_048_576; // 1MB
const VALID_ACTIONS = ['create_task', 'update_task', 'create_notification', 'trigger_automation'];

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.MAKE_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Make webhook integration is not configured. Contact admin.' },
        { status: 422 },
      );
    }

    // Verify secret from custom header
    const providedSecret = req.headers.get('x-webhook-secret') || '';
    if (!providedSecret || providedSecret.length !== secret.length) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    try {
      if (!timingSafeEqual(Buffer.from(providedSecret), Buffer.from(secret))) {
        return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Replay protection — mandatory to prevent duplicate processing
    const makeId = req.headers.get('x-make-execution-id') || '';
    if (!makeId) {
      return NextResponse.json({ error: 'x-make-execution-id header is required' }, { status: 400 });
    }
    const isNew = await checkReplayProtection('make', makeId);
    if (!isNew) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Determine action type from payload and validate against whitelist
    const actionType = payload._solis_action || 'create_task';
    if (!VALID_ACTIONS.includes(actionType)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }
    const actionConfig = payload._solis_config || {};

    // Remove SOLIS meta fields from payload before processing
    const cleanPayload = { ...payload };
    delete cleanPayload._solis_action;
    delete cleanPayload._solis_config;

    const result = await processIncomingWebhook(
      { actionType, actionConfig },
      cleanPayload,
    );

    return NextResponse.json({
      ok: result.success,
      action: result.action,
      entityId: result.entityId,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[Make Webhook] Error:', err?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
