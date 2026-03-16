// ============================================================
// Chat Automation Trigger — Fires automations when chat
// messages match configured patterns.
// ============================================================

import { adminDb } from './firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { FieldValue } from 'firebase-admin/firestore';

export interface ChatTriggerConfig {
  matchType: 'contains' | 'regex' | 'starts_with' | 'exact';
  pattern: string;
  channelFilter?: string[];
  mentionFilter?: 'any' | 'bot_only' | 'specific_user';
}

/**
 * Pure function: check if a message matches a chat trigger config.
 */
export function matchesChatTrigger(
  messageText: string,
  config: ChatTriggerConfig,
): boolean {
  if (!messageText || !config.pattern) return false;

  const text = messageText.toLowerCase();
  const pattern = config.pattern.toLowerCase();

  switch (config.matchType) {
    case 'exact':
      return text === pattern;
    case 'starts_with':
      return text.startsWith(pattern);
    case 'contains':
      return text.includes(pattern);
    case 'regex':
      try {
        const regex = new RegExp(config.pattern, 'i');
        return regex.test(messageText);
      } catch {
        return false; // Invalid regex — no match
      }
    default:
      return false;
  }
}

/**
 * Server-side: Process a chat message against all chat_message_received automations.
 */
export async function onChatMessageReceived(
  channelId: string,
  messageText: string,
  actorId: string,
  actorName: string,
): Promise<{ rulesTriggered: number; errors: string[] }> {
  const errors: string[] = [];
  let rulesTriggered = 0;

  try {
    // Query enabled automations with chat trigger
    const snap = await adminDb.collection('automations')
      .where('orgId', '==', ORG)
      .where('enabled', '==', true)
      .where('trigger', '==', 'chat_message_received')
      .get();

    for (const doc of snap.docs) {
      const rule = { id: doc.id, ...doc.data() } as any;
      const config: ChatTriggerConfig = {
        matchType: rule.triggerConfig?.matchType || 'contains',
        pattern: rule.triggerConfig?.pattern || '',
        channelFilter: rule.triggerConfig?.channelFilter ? rule.triggerConfig.channelFilter.split(',') : undefined,
        mentionFilter: rule.triggerConfig?.mentionFilter,
      };

      // Channel filter
      if (config.channelFilter && config.channelFilter.length > 0) {
        if (!config.channelFilter.includes(channelId)) continue;
      }

      // Message match
      if (!matchesChatTrigger(messageText, config)) continue;

      try {
        // Execute actions
        for (const action of rule.actions || []) {
          switch (action.type) {
            case 'post_comment': {
              // Create a task from the message context
              break;
            }
            case 'send_notification': {
              const message = action.config.message || `Chat trigger: ${messageText.slice(0, 100)}`;
              const recipientIds = action.config.recipientIds?.split(',') || [];
              if (recipientIds.length > 0) {
                for (const uid of recipientIds) {
                  await adminDb.collection(`orgs/${ORG}/notifications`).add({
                    userId: uid.trim(),
                    type: 'system',
                    title: `Chat Automation: ${rule.name}`,
                    message,
                    entityType: 'channel',
                    entityId: channelId,
                    read: false,
                    createdAt: FieldValue.serverTimestamp(),
                  });
                }
              }
              break;
            }
            case 'call_webhook': {
              const url = action.config.webhookUrl;
              if (url) {
                await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event: 'chat_automation_triggered',
                    channelId,
                    messageText,
                    actorId,
                    actorName,
                    automationName: rule.name,
                  }),
                });
              }
              break;
            }
            case 'create_task': {
              const title = action.config.taskTitle || `From chat: ${messageText.slice(0, 80)}`;
              await adminDb.collection('tasks').add({
                orgId: ORG,
                title,
                description: `Created from chat message by ${actorName}:\n\n> ${messageText}`,
                status: action.config.status || 'todo',
                priority: action.config.priority || 'medium',
                type: 'task',
                visibility: 'team',
                assignees: action.config.assigneeId ? [action.config.assigneeId] : [],
                tags: ['from-chat'],
                teamId: rule.teamId || '',
                listId: action.config.listId || null,
                subtasks: [],
                checklist: [],
                attachments: [],
                dependencies: [],
                customFields: {},
                watchers: [],
                archived: false,
                createdBy: actorId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
              break;
            }
          }
        }

        // Update stats
        await adminDb.doc(`automations/${rule.id}`).update({
          runCount: FieldValue.increment(1),
          lastRunAt: FieldValue.serverTimestamp(),
          consecutiveErrors: 0,
        });

        // Log
        await adminDb.collection(`automations/${rule.id}/logs`).add({
          status: 'success',
          triggerType: 'chat_message_received',
          actorId,
          channelId,
          messagePreview: messageText.slice(0, 200),
          createdAt: FieldValue.serverTimestamp(),
        });

        rulesTriggered++;
      } catch (err: any) {
        errors.push(`Rule ${rule.name}: ${err.message}`);
        await adminDb.doc(`automations/${rule.id}`).update({
          errorCount: FieldValue.increment(1),
          consecutiveErrors: FieldValue.increment(1),
        });
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  return { rulesTriggered, errors };
}
