import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getSlackToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('slack');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function sendSlackMessage(channel: string, text: string): Promise<boolean> {
  const token = await getSlackToken();
  if (!token) return false;

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text }),
  });

  const data = await res.json();
  return data.ok === true;
}

export async function listSlackChannels(): Promise<{ id: string; name: string }[]> {
  const token = await getSlackToken();
  if (!token) return [];

  const res = await fetch('https://slack.com/api/conversations.list?types=public_channel&limit=100', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await res.json();
  if (!data.ok) return [];

  return (data.channels || []).map((ch: any) => ({
    id: ch.id,
    name: ch.name,
  }));
}

export async function sendSlackRichMessage(
  channel: string,
  blocks: any[],
  text?: string,
): Promise<{ ok: boolean; ts?: string }> {
  const token = await getSlackToken();
  if (!token) return { ok: false };

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, blocks, text: text || '' }),
  });

  const data = await res.json();
  return { ok: data.ok === true, ts: data.ts };
}

export async function sendSlackTaskNotification(
  channel: string,
  task: { title: string; status?: string; assignee?: string; url?: string },
  action: 'created' | 'updated' | 'completed' | 'deleted',
): Promise<boolean> {
  const emoji = action === 'created' ? ':new:' : action === 'completed' ? ':white_check_mark:' : action === 'deleted' ? ':wastebasket:' : ':pencil2:';
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *Task ${action}:* ${task.url ? `<${task.url}|${task.title}>` : task.title}`,
      },
    },
    {
      type: 'context',
      elements: [
        ...(task.status ? [{ type: 'mrkdwn', text: `*Status:* ${task.status}` }] : []),
        ...(task.assignee ? [{ type: 'mrkdwn', text: `*Assignee:* ${task.assignee}` }] : []),
      ].filter(Boolean),
    },
  ];

  const result = await sendSlackRichMessage(channel, blocks, `Task ${action}: ${task.title}`);
  return result.ok;
}
