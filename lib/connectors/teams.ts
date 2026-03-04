import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getTeamsToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('teams');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function sendTeamsMessage(chatId: string, content: string): Promise<boolean> {
  const token = await getTeamsToken();
  if (!token) return false;
  const res = await fetch(`https://graph.microsoft.com/v1.0/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { content } }),
  });
  return res.ok;
}

export async function listTeamsChats(): Promise<{ id: string; topic: string }[]> {
  const token = await getTeamsToken();
  if (!token) return [];
  const res = await fetch('https://graph.microsoft.com/v1.0/me/chats?$top=50', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.value || []).map((c: any) => ({ id: c.id, topic: c.topic || 'Chat' }));
}

export async function listTeamsTeams(): Promise<{ id: string; displayName: string }[]> {
  const token = await getTeamsToken();
  if (!token) return [];
  const res = await fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.value || []).map((t: any) => ({ id: t.id, displayName: t.displayName }));
}
