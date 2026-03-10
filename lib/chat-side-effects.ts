// ============================================================
// Client-Side Chat Side Effects — Unified Dispatcher
// ============================================================
//
// DESIGN DECISIONS:
// - Webhooks: NO — chat events not in webhook catalog (MessageSentEvent
//   is typed but not wired to WebhookEvent). Internal-only module.
// - Automations: NO — engine is task-trigger only.
// - Activity log: NO — messages ARE the activity log.
// - Channel metadata update: YES — handled inside sendMessage() in db.ts
//   (lastMessageAt, lastMessagePreview, lastMessageBy).
// - Unread/accounting: YES — handled by markChannelRead in db.ts via
//   readCursors. Not a side effect of sending.
//
// What this dispatcher covers:
// - notifyChannelMembers for messages
// - notifyMentionedUsers for @mentions
// - Persistent trace via eventLog

import { notifyMany } from './notifications';
import type {
  MessageSentEvent,
  SideEffectResult,
  DispatchResult,
  EffectCriticality,
} from './event-types';
import { generateCorrelationId } from './event-types';
import { persistDispatchResult } from './event-log';

async function runEffect(
  name: string,
  criticality: EffectCriticality,
  fn: () => Promise<unknown>,
): Promise<SideEffectResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, criticality, success: true, durationMs: Date.now() - start };
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    console.error(`[SideEffect:${name}] failed:`, msg);
    return { name, criticality, success: false, error: msg, durationMs: Date.now() - start };
  }
}

function buildResult(correlationId: string, event: string, effects: SideEffectResult[]): DispatchResult {
  return {
    correlationId,
    event,
    effects,
    hasFailures: effects.some(e => !e.success),
    criticalFailure: effects.some(e => !e.success && e.criticality === 'critical'),
  };
}

// ============================================================
// afterMessageSent
// ============================================================
// Effects:
//   [important] notifyChannelMembers (all members except sender)
//   [important] notifyMentionedUsers (mentioned users except sender)

export async function afterMessageSent(event: Omit<MessageSentEvent, 'type'> & {
  channelName: string;
  channelType: string;
  memberIds: string[];
  mentionIds: string[];
}): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];
  const { channelId, message, actor, channelName, channelType, memberIds, mentionIds } = event;
  const content = (message.content || '').slice(0, 80);
  const displayChannel = channelType === 'dm' ? 'mensaje directo' : `#${channelName}`;

  // Notify channel members
  const recipientIds = memberIds.filter(id => id !== actor.actorId);
  if (recipientIds.length > 0) {
    effects.push(await runEffect('notifyChannelMembers', 'important', () =>
      notifyMany(recipientIds, {
        type: 'channel_message',
        title: `Nuevo mensaje en ${displayChannel}`,
        message: content,
        entityType: 'channel',
        entityId: channelId,
        entityUrl: '/app/chat',
        actorId: actor.actorId,
        actorName: actor.actorName,
      }).then(() => {}),
    ));
  }

  // Notify mentioned users
  const mentionRecipients = mentionIds.filter(id => id !== actor.actorId);
  if (mentionRecipients.length > 0) {
    effects.push(await runEffect('notifyMentionedUsers', 'important', () =>
      notifyMany(mentionRecipients, {
        type: 'channel_mention',
        title: `${actor.actorName} te mencionó en ${displayChannel}`,
        message: content,
        entityType: 'channel',
        entityId: channelId,
        entityUrl: '/app/chat',
        actorId: actor.actorId,
        actorName: actor.actorName,
      }).then(() => {}),
    ));
  }

  const result = buildResult(cid, 'message.sent', effects);
  persistDispatchResult(result, { entityType: 'channel', entityId: channelId, actorId: actor.actorId });
  return result;
}
