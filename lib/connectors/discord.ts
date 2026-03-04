import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getDiscordToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('discord');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function sendDiscordMessage(
  channelId: string,
  content: string,
): Promise<boolean> {
  const token = await getDiscordToken();
  if (!token) return false;

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  return res.ok;
}

export async function listDiscordGuilds(): Promise<{ id: string; name: string; icon: string | null }[]> {
  const token = await getDiscordToken();
  if (!token) return [];

  const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
  }));
}

export async function listDiscordChannels(
  guildId: string,
): Promise<{ id: string; name: string; type: number }[]> {
  const token = await getDiscordToken();
  if (!token) return [];

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { 'Authorization': `Bot ${token}` },
  });

  if (!res.ok) return [];

  const data = await res.json();
  // Filter to text channels (type 0)
  return (data || [])
    .filter((ch: any) => ch.type === 0)
    .map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
    }));
}
