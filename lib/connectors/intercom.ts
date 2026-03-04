import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getIntercomToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('intercom');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function listIntercomContacts(limit = 20): Promise<{ id: string; name: string; email: string; role: string }[]> {
  const token = await getIntercomToken();
  if (!token) return [];
  const res = await fetch(`https://api.intercom.io/contacts?per_page=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map((c: any) => ({
    id: c.id, name: c.name || '', email: c.email || '', role: c.role || '',
  }));
}

export async function listIntercomConversations(limit = 20): Promise<{ id: string; title: string; state: string }[]> {
  const token = await getIntercomToken();
  if (!token) return [];
  const res = await fetch(`https://api.intercom.io/conversations?per_page=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.conversations || []).map((c: any) => ({
    id: c.id, title: c.source?.subject || c.source?.body?.slice(0, 60) || 'Conversation', state: c.state || '',
  }));
}
