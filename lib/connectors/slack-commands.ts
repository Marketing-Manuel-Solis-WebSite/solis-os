// ============================================================
// Slack Slash Commands — handle /solis-task commands from Slack
// ============================================================

import { createHmac, timingSafeEqual } from 'crypto';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';

// ---- Signature Verification ----

export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const computed = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex');

  if (computed.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ---- Block Kit Response Helpers ----

export interface SlackBlockResponse {
  response_type?: 'in_channel' | 'ephemeral';
  text: string;
  blocks?: any[];
}

function errorResponse(message: string): SlackBlockResponse {
  return {
    response_type: 'ephemeral',
    text: message,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `:x: ${message}` } },
    ],
  };
}

// ---- Command Parsing ----

export interface ParsedCommand {
  action: 'create' | 'list' | 'status' | 'help' | 'unknown';
  args: string;
}

export function parseCommand(text: string): ParsedCommand {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed === 'help') {
    return { action: 'help', args: '' };
  }

  const parts = trimmed.split(/\s+/);
  const action = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ').trim();

  switch (action) {
    case 'create':
      return { action: 'create', args };
    case 'list':
      return { action: 'list', args };
    case 'status':
      return { action: 'status', args };
    default:
      return { action: 'unknown', args: trimmed };
  }
}

// ---- Slack User ID -> SOLIS User mapping ----

async function findUserBySlackId(slackUserId: string): Promise<string | null> {
  // Look for a user with a linked Slack ID in their profile
  const snap = await adminDb.collection('members')
    .where('orgId', '==', ORG)
    .where('slackUserId', '==', slackUserId)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;

  // Fallback: use any active member (for now)
  const fallback = await adminDb.collection('members')
    .where('orgId', '==', ORG)
    .limit(1)
    .get();
  return fallback.empty ? null : fallback.docs[0].id;
}

// ---- Command Handlers ----

export async function handleCreateTask(
  text: string,
  slackUserId: string,
): Promise<SlackBlockResponse> {
  if (!text.trim()) {
    return errorResponse('Please provide a task title: `/solis-task create My task title`');
  }

  const userId = await findUserBySlackId(slackUserId);
  const taskRef = await adminDb.collection('tasks').add({
    orgId: ORG,
    title: text.trim().slice(0, 500),
    description: '',
    status: 'todo',
    priority: 'medium',
    type: 'task',
    visibility: 'team',
    assignees: userId ? [userId] : [],
    tags: ['slack'],
    teamId: '',
    listId: null,
    createdBy: userId || 'slack-command',
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

  return {
    response_type: 'in_channel',
    text: `Task created: ${text.trim()}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark: *Task created successfully!*\n*Title:* ${text.trim()}\n*ID:* \`${taskRef.id}\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in SOLIS' },
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.solis.dev'}/app/tasks?taskId=${taskRef.id}`,
            action_id: 'view_task',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Mark In Progress' },
            action_id: `task_status_${taskRef.id}_in_progress`,
            style: 'primary',
          },
        ],
      },
    ],
  };
}

export async function handleListTasks(
  slackUserId: string,
): Promise<SlackBlockResponse> {
  const userId = await findUserBySlackId(slackUserId);

  let q = adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '==', false)
    .where('archived', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(10);

  if (userId) {
    q = adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where('deleted', '==', false)
      .where('archived', '==', false)
      .where('assignees', 'array-contains', userId)
      .orderBy('createdAt', 'desc')
      .limit(10);
  }

  const snap = await q.get();
  if (snap.empty) {
    return {
      response_type: 'ephemeral',
      text: 'No tasks found.',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: ':clipboard: No tasks found assigned to you.' } },
      ],
    };
  }

  const statusEmoji: Record<string, string> = {
    todo: ':white_circle:',
    in_progress: ':large_blue_circle:',
    review: ':yellow_circle:',
    done: ':white_check_mark:',
  };

  const taskLines = snap.docs.map((d) => {
    const data = d.data();
    const emoji = statusEmoji[data.status] || ':grey_question:';
    return `${emoji} \`${d.id.slice(0, 8)}\` *${data.title}* — _${data.status}_`;
  });

  return {
    response_type: 'ephemeral',
    text: `Your recent tasks (${snap.docs.length})`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `:clipboard: *Your Recent Tasks (${snap.docs.length})*` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: taskLines.join('\n') },
      },
    ],
  };
}

export async function handleTaskStatus(
  taskId: string,
): Promise<SlackBlockResponse> {
  if (!taskId.trim()) {
    return errorResponse('Please provide a task ID: `/solis-task status <task-id>`');
  }

  const cleaned = taskId.trim();
  const docRef = adminDb.doc(`tasks/${cleaned}`);
  const snap = await docRef.get();

  if (!snap.exists) {
    return errorResponse(`Task \`${cleaned}\` not found.`);
  }

  const task = snap.data()!;
  const priorityEmoji: Record<string, string> = {
    urgent: ':red_circle:',
    high: ':orange_circle:',
    medium: ':yellow_circle:',
    low: ':white_circle:',
  };

  return {
    response_type: 'ephemeral',
    text: `Task: ${task.title}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `:page_facing_up: *${task.title}*`,
            `*Status:* ${task.status}`,
            `*Priority:* ${priorityEmoji[task.priority] || ''} ${task.priority}`,
            task.description ? `*Description:* ${task.description.slice(0, 200)}` : '',
            task.assignees?.length > 0 ? `*Assignees:* ${task.assignees.length} member(s)` : '',
          ].filter(Boolean).join('\n'),
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in SOLIS' },
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.solis.dev'}/app/tasks?taskId=${cleaned}`,
            action_id: 'view_task',
          },
        ],
      },
    ],
  };
}

export function handleHelp(): SlackBlockResponse {
  return {
    response_type: 'ephemeral',
    text: 'SOLIS Task Commands',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            ':rocket: *SOLIS Task Commands*',
            '',
            '`/solis-task create <title>` — Create a new task',
            '`/solis-task list` — List your recent tasks',
            '`/solis-task status <id>` — Show task details',
            '`/solis-task help` — Show this help message',
          ].join('\n'),
        },
      },
    ],
  };
}

// ---- Main Dispatcher ----

export async function dispatchSlackCommand(
  command: ParsedCommand,
  slackUserId: string,
): Promise<SlackBlockResponse> {
  switch (command.action) {
    case 'create':
      return handleCreateTask(command.args, slackUserId);
    case 'list':
      return handleListTasks(slackUserId);
    case 'status':
      return handleTaskStatus(command.args);
    case 'help':
      return handleHelp();
    default:
      return errorResponse(`Unknown command: \`${command.args}\`. Type \`/solis-task help\` for usage.`);
  }
}
