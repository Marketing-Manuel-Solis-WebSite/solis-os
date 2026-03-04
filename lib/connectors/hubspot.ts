import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getHubSpotToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('hubspot');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function listHubSpotContacts(limit = 20): Promise<{ id: string; email: string; firstname: string; lastname: string }[]> {
  const token = await getHubSpotToken();
  if (!token) return [];
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((c: any) => ({
    id: c.id, email: c.properties?.email || '', firstname: c.properties?.firstname || '', lastname: c.properties?.lastname || '',
  }));
}

export async function createHubSpotContact(email: string, firstname?: string, lastname?: string): Promise<{ id: string } | null> {
  const token = await getHubSpotToken();
  if (!token) return null;
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { email, firstname: firstname || '', lastname: lastname || '' } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id };
}

export async function listHubSpotDeals(limit = 20): Promise<{ id: string; dealname: string; amount: string; dealstage: string }[]> {
  const token = await getHubSpotToken();
  if (!token) return [];
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((d: any) => ({
    id: d.id, dealname: d.properties?.dealname || '', amount: d.properties?.amount || '0', dealstage: d.properties?.dealstage || '',
  }));
}
