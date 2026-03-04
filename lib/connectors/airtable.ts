import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getAirtableToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('airtable');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function listAirtableBases(): Promise<{ id: string; name: string }[]> {
  const token = await getAirtableToken();
  if (!token) return [];
  const res = await fetch('https://api.airtable.com/v0/meta/bases', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.bases || []).map((b: any) => ({ id: b.id, name: b.name }));
}

export async function listAirtableRecords(baseId: string, tableId: string, maxRecords = 25): Promise<any[]> {
  const token = await getAirtableToken();
  if (!token) return [];
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}?maxRecords=${maxRecords}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.records || []).map((r: any) => ({ id: r.id, fields: r.fields || {} }));
}

export async function createAirtableRecord(baseId: string, tableId: string, fields: Record<string, any>): Promise<{ id: string } | null> {
  const token = await getAirtableToken();
  if (!token) return null;
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id };
}
