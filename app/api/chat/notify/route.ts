import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { notifyUsersAdmin, type NotifyParams } from '@/lib/notify-admin';

// ============================================================
// Server-side chat notification dispatch
// ============================================================
// Routes chat notifications through the Phase 3 pipeline
// (notifyUsersAdmin) which respects the notification matrix:
// dedup, email preferences, inbox items — all policy-driven.
//
// Replaces client-side notifyMany() for chat, which bypassed
// the matrix and spammed email for channel_message (email:false).
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userIds, eventType, title, message, entityType, entityId, entityUrl, actorId, actorName } = body;

    if (!userIds?.length || !eventType || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Caller can only send as themselves
    if (actorId && actorId !== authedUser.uid) {
      return NextResponse.json({ error: 'actorId must match authenticated user' }, { status: 403 });
    }

    const params: NotifyParams = {
      eventType,
      title,
      message: message || '',
      entityType,
      entityId,
      entityUrl,
      actorId: actorId || authedUser.uid,
      actorName: actorName || '',
    };

    const results = await notifyUsersAdmin(userIds, params);
    return NextResponse.json({
      ok: true,
      sent: results.filter(r => r.notificationCreated).length,
      deduped: results.filter(r => r.deduped).length,
    });
  } catch (error: any) {
    console.error('[chat/notify] error:', error);
    return NextResponse.json({ error: error.message || 'Notification dispatch failed' }, { status: 500 });
  }
}
