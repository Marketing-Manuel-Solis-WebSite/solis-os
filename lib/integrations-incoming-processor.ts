// ============================================================
// Incoming Webhook Processor — handle payloads from external services
// ============================================================
// Processes incoming webhook payloads based on the configured actionType:
// - create_task: Creates a task from the webhook payload
// - create_notification: Creates a notification for specified users
// - trigger_automation: Triggers an automation rule by name

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';



export interface IncomingWebhookConfig {
  actionType: 'create_task' | 'create_notification' | 'trigger_automation';
  actionConfig: Record<string, any>;
}

export interface ProcessResult {
  success: boolean;
  action: string;
  entityId?: string;
  error?: string;
}

/**
 * Process an incoming webhook payload based on the configured action.
 */
export async function processIncomingWebhook(
  config: IncomingWebhookConfig,
  payload: Record<string, any>,
): Promise<ProcessResult> {
  try {
    switch (config.actionType) {
      case 'create_task':
        return await handleCreateTask(config.actionConfig, payload);
      case 'create_notification':
        return await handleCreateNotification(config.actionConfig, payload);
      case 'trigger_automation':
        return await handleTriggerAutomation(config.actionConfig, payload);
      default:
        return { success: false, action: config.actionType, error: `Unknown action: ${config.actionType}` };
    }
  } catch (err: any) {
    return { success: false, action: config.actionType, error: err?.message || 'Unknown error' };
  }
}

// ---- Action Handlers ----

async function handleCreateTask(
  actionConfig: Record<string, any>,
  payload: Record<string, any>,
): Promise<ProcessResult> {
  const title = payload.title || payload.summary || payload.name || actionConfig.defaultTitle || 'Webhook Task';
  const description = payload.description || payload.body || payload.text || '';
  const teamId = actionConfig.teamId || '';
  const listId = actionConfig.listId || null;
  const status = actionConfig.defaultStatus || 'todo';
  const priority = actionConfig.defaultPriority || 'medium';

  const taskRef = await adminDb.collection('tasks').add({
    orgId: ORG,
    title: String(title).slice(0, 500),
    description: String(description).slice(0, 5000),
    status,
    priority,
    type: 'task',
    visibility: 'team',
    assignees: actionConfig.defaultAssignees || [],
    tags: actionConfig.defaultTags || ['webhook'],
    teamId,
    listId,
    createdBy: 'incoming-webhook',
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

  return { success: true, action: 'create_task', entityId: taskRef.id };
}

async function handleCreateNotification(
  actionConfig: Record<string, any>,
  payload: Record<string, any>,
): Promise<ProcessResult> {
  const userIds: string[] = actionConfig.notifyUserIds || [];
  if (userIds.length === 0) {
    return { success: false, action: 'create_notification', error: 'No users configured' };
  }

  const title = payload.title || actionConfig.defaultTitle || 'Webhook Notification';
  const message = payload.message || payload.text || payload.body || '';

  const batch = adminDb.batch();
  for (const userId of userIds) {
    const ref = adminDb.collection(`orgs/${ORG}/notifications`).doc();
    batch.set(ref, {
      userId,
      type: 'system',
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 500),
      entityType: 'webhook',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return { success: true, action: 'create_notification' };
}

async function handleTriggerAutomation(
  actionConfig: Record<string, any>,
  payload: Record<string, any>,
): Promise<ProcessResult> {
  const automationName = actionConfig.automationName || '';
  if (!automationName) {
    return { success: false, action: 'trigger_automation', error: 'No automation name configured' };
  }

  // Find the automation by name
  const snap = await adminDb.collection('automations')
    .where('orgId', '==', ORG)
    .where('name', '==', automationName)
    .where('enabled', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    return { success: false, action: 'trigger_automation', error: `Automation "${automationName}" not found or disabled` };
  }

  const rule = snap.docs[0];

  // Log the manual trigger
  await adminDb.collection(`automations/${rule.id}/logs`).add({
    status: 'triggered',
    actionsExecuted: [],
    duration: 0,
    triggerData: { source: 'incoming_webhook', payload: JSON.stringify(payload).slice(0, 1000) },
    actorId: 'incoming-webhook',
    error: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update run count
  await adminDb.doc(`automations/${rule.id}`).update({
    runCount: FieldValue.increment(1),
    lastRunAt: FieldValue.serverTimestamp(),
  });

  return { success: true, action: 'trigger_automation', entityId: rule.id };
}
