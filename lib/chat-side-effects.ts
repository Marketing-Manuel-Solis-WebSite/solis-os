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
// NOTIFICATION PIPELINE (Phase 7):
// - Notifications route through /api/chat/notify which calls
//   notifyUsersAdmin (Phase 3 pipeline: dedup + email + inbox).
// - This ensures notification-matrix.ts is respected:
//   - channel_message: inApp only (email:false, inbox:false)
//   - channel_mention: inApp + email + inbox + dedup
// - Previous implementation used client-side notifyMany() which
//   bypassed the matrix (no dedup, no inbox, email spam).
//
// What this dispatcher covers:
// - notifyChannelMembers for messages (via server pipeline)
// - notifyMentionedUsers for @mentions (via server pipeline)
// - Persistent trace via eventLog

import { auth } from './firebase';
import type {
  MessageSentEvent,
  SideEffectResult,
  DispatchResult,
  EffectCriticality,
} from './event-types';
import { generateCorrelationId } from './event-types';
import { persistDispatchResult } from './event-log';

// ---- Mention extraction ----

/**
 * Extract @mention display names from message text.
 * Matches @Word patterns, capturing the first word after @.
 * Supports accented characters (e.g. @Jose, @Maria).
 * Returns an array of single-word name strings (without the @ prefix).
 * Use resolveMentionIds() to match these against members via startsWith.
 */
export function extractMentionNames(text: string): string[] {
  const MENTION_RE = /@([A-Za-z\u00C0-\u024F]+)/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(text)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Resolve mention display names to user IDs.
 * Given a list of members and extracted names, returns matching user IDs.
 * Case-insensitive matching on displayName.
 */
export function resolveMentionIds(
  mentionNames: string[],
  members: { id: string; displayName?: string }[],
): string[] {
  const ids: string[] = [];
  for (const name of mentionNames) {
    const lower = name.toLowerCase();
    const member = members.find(m =>
      m.displayName?.toLowerCase() === lower ||
      m.displayName?.toLowerCase().startsWith(lower)
    );
    if (member && !ids.includes(member.id)) {
      ids.push(member.id);
    }
  }
  return ids;
}

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

// Route notifications through server pipeline (Phase 3: dedup + email + inbox)
async function notifyViaServer(userIds: string[], params: {
  eventType: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  actorId?: string;
  actorName?: string;
}): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  const res = await fetch('/api/chat/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ userIds, ...params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

// ============================================================
// afterMessageSent
// ============================================================
// Effects:
//   [important] notifyChannelMembers (all members except sender)
//   [important] notifyMentionedUsers (mentioned users except sender)
//
// Both effects go through /api/chat/notify → notifyUsersAdmin
// which respects notification-matrix.ts policies.

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

  // Notify channel members (matrix: channel_message → inApp only, no email)
  const recipientIds = memberIds.filter(id => id !== actor.actorId);
  if (recipientIds.length > 0) {
    effects.push(await runEffect('notifyChannelMembers', 'important', () =>
      notifyViaServer(recipientIds, {
        eventType: 'channel_message',
        title: `Nuevo mensaje en ${displayChannel}`,
        message: content,
        entityType: 'channel',
        entityId: channelId,
        entityUrl: '/app/chat',
        actorId: actor.actorId,
        actorName: actor.actorName,
      }),
    ));
  }

  // Notify mentioned users (matrix: channel_mention → inApp + email + inbox + dedup)
  const mentionRecipients = mentionIds.filter(id => id !== actor.actorId);
  if (mentionRecipients.length > 0) {
    effects.push(await runEffect('notifyMentionedUsers', 'important', () =>
      notifyViaServer(mentionRecipients, {
        eventType: 'channel_mention',
        title: `${actor.actorName} te mencionó en ${displayChannel}`,
        message: content,
        entityType: 'channel',
        entityId: channelId,
        entityUrl: '/app/chat',
        actorId: actor.actorId,
        actorName: actor.actorName,
      }),
    ));
  }

  // Chat automation trigger (fire-and-forget, best-effort)
  try {
    fetch('/api/chat/automation-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        messageText: message.content || '',
        actorId: actor.actorId,
        actorName: actor.actorName,
      }),
    }).catch(() => {}); // best-effort, don't block
  } catch {}

  const result = buildResult(cid, 'message.sent', effects);
  persistDispatchResult(result, { entityType: 'channel', entityId: channelId, actorId: actor.actorId });
  return result;
}
