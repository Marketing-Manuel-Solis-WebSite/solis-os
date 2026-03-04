import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getNotionToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('notion');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function searchNotionPages(query?: string): Promise<{ id: string; title: string; url: string; type: string }[]> {
  const token = await getNotionToken();
  if (!token) return [];
  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query || '', page_size: 25 }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((r: any) => {
    const title = r.properties?.title?.title?.[0]?.plain_text || r.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
    return { id: r.id, title, url: r.url || '', type: r.object || '' };
  });
}

export async function listNotionDatabases(): Promise<{ id: string; title: string }[]> {
  const token = await getNotionToken();
  if (!token) return [];
  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter: { value: 'database', property: 'object' }, page_size: 25 }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((d: any) => ({
    id: d.id, title: d.title?.[0]?.plain_text || 'Untitled',
  }));
}
