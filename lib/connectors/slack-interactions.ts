// ============================================================
// Slack Interactive Components — handle button actions, modals, shortcuts
// ============================================================

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';

export interface SlackInteractionPayload {
  type: 'block_actions' | 'view_submission' | 'shortcut' | 'message_action';
  user: { id: string; name: string };
  trigger_id?: string;
  actions?: Array<{
    action_id: string;
    type: string;
    value?: string;
    selected_option?: { value: string };
  }>;
  view?: {
    callback_id: string;
    state?: {
      values: Record<string, Record<string, { value?: string; selected_option?: { value: string } }>>;
    };
    private_metadata?: string;
  };
  callback_id?: string;
}

export interface SlackInteractionResponse {
  response_action?: 'clear' | 'update' | 'errors';
  text?: string;
  blocks?: any[];
  errors?: Record<string, string>;
}

// ---- Block Actions Handler (button clicks, select menus) ----

export async function handleBlockActions(
  payload: SlackInteractionPayload,
): Promise<SlackInteractionResponse | null> {
  const actions = payload.actions || [];

  for (const action of actions) {
    // Handle task status update buttons (action_id: task_status_{taskId}_{status})
    const statusMatch = action.action_id.match(/^task_status_(.+?)_(.+)$/);
    if (statusMatch) {
      const [, taskId, newStatus] = statusMatch;
      return await handleTaskStatusUpdate(taskId, newStatus, payload.user.id);
    }

    // Handle view_task — no server action needed (URL button)
    if (action.action_id === 'view_task') {
      return null;
    }
  }

  return null;
}

async function handleTaskStatusUpdate(
  taskId: string,
  newStatus: string,
  slackUserId: string,
): Promise<SlackInteractionResponse> {
  try {
    const docRef = adminDb.doc(`tasks/${taskId}`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { text: `Task \`${taskId}\` not found.` };
    }

    const task = snap.data()!;
    const oldStatus = task.status;

    await docRef.update({
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const statusLabel: Record<string, string> = {
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'Review',
      done: 'Done',
    };

    return {
      text: `:white_check_mark: Task *${task.title}* status changed from _${statusLabel[oldStatus] || oldStatus}_ to _${statusLabel[newStatus] || newStatus}_.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: Task *${task.title}* status updated to *${statusLabel[newStatus] || newStatus}*`,
          },
        },
      ],
    };
  } catch (err: any) {
    console.error('[Slack Interactions] Status update failed:', err?.message);
    return { text: 'Failed to update task status. Please try again.' };
  }
}

// ---- View Submission Handler (modal forms) ----

export async function handleViewSubmission(
  payload: SlackInteractionPayload,
): Promise<SlackInteractionResponse | null> {
  const callbackId = payload.view?.callback_id;

  if (callbackId === 'create_task_modal') {
    return await handleCreateTaskModal(payload);
  }

  return null;
}

async function handleCreateTaskModal(
  payload: SlackInteractionPayload,
): Promise<SlackInteractionResponse> {
  const values = payload.view?.state?.values || {};

  // Extract values from modal blocks
  const titleInput = values['task_title_block']?.['task_title_input'];
  const descInput = values['task_desc_block']?.['task_desc_input'];
  const priorityInput = values['task_priority_block']?.['task_priority_select'];

  const title = titleInput?.value || '';
  const description = descInput?.value || '';
  const priority = priorityInput?.selected_option?.value || 'medium';

  if (!title.trim()) {
    return {
      response_action: 'errors',
      errors: { task_title_block: 'Title is required' },
    };
  }

  try {
    await adminDb.collection('tasks').add({
      orgId: ORG,
      title: title.trim().slice(0, 500),
      description: description.slice(0, 5000),
      status: 'todo',
      priority,
      type: 'task',
      visibility: 'team',
      assignees: [],
      tags: ['slack'],
      teamId: '',
      listId: null,
      createdBy: 'slack-modal',
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

    return { response_action: 'clear' };
  } catch {
    return {
      response_action: 'errors',
      errors: { task_title_block: 'Failed to create task. Try again.' },
    };
  }
}

// ---- Shortcut Handler (global or message shortcuts) ----

export async function handleShortcut(
  _payload: SlackInteractionPayload,
): Promise<SlackInteractionResponse | null> {
  // Shortcuts open modals via Slack API. Return null to acknowledge.
  // Actual modal opening requires calling Slack's views.open API.
  return null;
}

// ---- Main Dispatcher ----

export async function dispatchSlackInteraction(
  payload: SlackInteractionPayload,
): Promise<SlackInteractionResponse | null> {
  switch (payload.type) {
    case 'block_actions':
      return handleBlockActions(payload);
    case 'view_submission':
      return handleViewSubmission(payload);
    case 'shortcut':
    case 'message_action':
      return handleShortcut(payload);
    default:
      return null;
  }
}

// ---- Modal Definitions ----

export function getCreateTaskModalView(): any {
  return {
    type: 'modal',
    callback_id: 'create_task_modal',
    title: { type: 'plain_text', text: 'Create SOLIS Task' },
    submit: { type: 'plain_text', text: 'Create' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'task_title_block',
        label: { type: 'plain_text', text: 'Task Title' },
        element: {
          type: 'plain_text_input',
          action_id: 'task_title_input',
          placeholder: { type: 'plain_text', text: 'Enter task title' },
        },
      },
      {
        type: 'input',
        block_id: 'task_desc_block',
        optional: true,
        label: { type: 'plain_text', text: 'Description' },
        element: {
          type: 'plain_text_input',
          action_id: 'task_desc_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Enter description' },
        },
      },
      {
        type: 'input',
        block_id: 'task_priority_block',
        optional: true,
        label: { type: 'plain_text', text: 'Priority' },
        element: {
          type: 'static_select',
          action_id: 'task_priority_select',
          placeholder: { type: 'plain_text', text: 'Select priority' },
          options: [
            { text: { type: 'plain_text', text: 'Low' }, value: 'low' },
            { text: { type: 'plain_text', text: 'Medium' }, value: 'medium' },
            { text: { type: 'plain_text', text: 'High' }, value: 'high' },
            { text: { type: 'plain_text', text: 'Urgent' }, value: 'urgent' },
          ],
          initial_option: { text: { type: 'plain_text', text: 'Medium' }, value: 'medium' },
        },
      },
    ],
  };
}
