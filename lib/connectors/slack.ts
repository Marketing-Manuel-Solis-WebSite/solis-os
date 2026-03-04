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
