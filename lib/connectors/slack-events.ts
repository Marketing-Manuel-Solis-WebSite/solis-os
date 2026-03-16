// ============================================================
// Slack Events API — handle app_mention, message events, etc.
// ============================================================

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';
import { sendSlackMessage } from './slack';

export interface SlackEvent {
  type: string;
  event_ts?: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
}

export interface SlackEventPayload {
  type: 'url_verification' | 'event_callback';
  challenge?: string;
  token?: string;
  event?: SlackEvent;
  event_id?: string;
}

export interface SlackEventResponse {
  ok: boolean;
  message?: string;
  challenge?: string;
}

// ---- URL Verification (Slack sends this when setting up Events API) ----

export function handleUrlVerification(
  challenge: string,
): { challenge: string } {
  return { challenge };
}

// ---- App Mention Handler ----

export async function handleAppMention(
  event: SlackEvent,
): Promise<SlackEventResponse> {
  // Ignore messages from bots to prevent loops
  if (event.bot_id) return { ok: true, message: 'Ignored bot message' };

  const text = (event.text || '').trim();
  const channel = event.channel || '';

  if (!channel) return { ok: false, message: 'No channel in event' };

  // Extract text after the mention (remove <@BOTID>)
  const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!cleanText) {
    await sendSlackMessage(
      channel,
      ':wave: Hi! I\'m SOLIS. Try mentioning me with a task title and I\'ll create it. Example: `@SOLIS Fix the login page bug`',
    ).catch(() => {});
    return { ok: true, message: 'Sent help message' };
  }

  // If mentioned with text, create a task from the mention
  if (cleanText.toLowerCase().startsWith('create ') || cleanText.toLowerCase().startsWith('task ')) {
    const title = cleanText.replace(/^(create|task)\s+/i, '').trim();
    if (title) {
      try {
        const taskRef = await adminDb.collection('tasks').add({
          orgId: ORG,
          title: title.slice(0, 500),
          description: `Created from Slack mention by <@${event.user}>`,
          status: 'todo',
          priority: 'medium',
          type: 'task',
          visibility: 'team',
          assignees: [],
          tags: ['slack'],
          teamId: '',
          listId: null,
          createdBy: 'slack-mention',
          subtasks: [],
          checklist: [],
          attachments: [],
          dependencies: [],
          customFields: {},
          watchers: [],
          archived: false,
          deleted: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await sendSlackMessage(
          channel,
          `:white_check_mark: Task created: *${title}* (ID: \`${taskRef.id}\`)`,
        ).catch(() => {});

        return { ok: true, message: 'Task created from mention' };
      } catch (err: any) {
        await sendSlackMessage(
          channel,
          `:x: Failed to create task: ${err?.message || 'Unknown error'}`,
        ).catch(() => {});
        return { ok: false, message: err?.message };
      }
    }
  }

  // Generic response for other mentions
  await sendSlackMessage(
    channel,
    `:robot_face: I heard you! Use \`@SOLIS create <title>\` to create a task, or use \`/solis-task\` for more commands.`,
  ).catch(() => {});

  return { ok: true, message: 'Sent generic response' };
}

// ---- Channel Message Handler ----

export async function handleChannelMessage(
  event: SlackEvent,
): Promise<SlackEventResponse> {
  // Ignore bot messages to prevent loops
  if (event.bot_id) return { ok: true, message: 'Ignored bot message' };

  // Log the event for analytics (non-blocking)
  try {
    await adminDb.collection('slackEventLog').add({
      orgId: ORG,
      eventType: 'message',
      channel: event.channel || '',
      user: event.user || '',
      textPreview: (event.text || '').slice(0, 100),
      threadTs: event.thread_ts || null,
      ts: event.ts || '',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Non-critical — log and continue
  }

  return { ok: true };
}

// ---- Main Dispatcher ----

export async function dispatchSlackEvent(
  payload: SlackEventPayload,
): Promise<SlackEventResponse | { challenge: string }> {
  // Handle URL verification challenge
  if (payload.type === 'url_verification' && payload.challenge) {
    return handleUrlVerification(payload.challenge);
  }

  const event = payload.event;
  if (!event) return { ok: false, message: 'No event in payload' };

  switch (event.type) {
    case 'app_mention':
      return handleAppMention(event);
    case 'message':
      return handleChannelMessage(event);
    default:
      return { ok: true, message: `Unhandled event type: ${event.type}` };
  }
}
