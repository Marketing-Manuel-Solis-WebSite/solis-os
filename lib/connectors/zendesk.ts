import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getZendeskToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('zendesk');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN || 'soliscenter';

export async function listZendeskTickets(status?: string): Promise<{ id: number; subject: string; status: string; priority: string }[]> {
  const token = await getZendeskToken();
  if (!token) return [];
  const query = status ? `type:ticket status:${status}` : 'type:ticket';
  const res = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/search.json?query=${encodeURIComponent(query)}&per_page=25`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((t: any) => ({
    id: t.id, subject: t.subject || '', status: t.status || '', priority: t.priority || '',
  }));
}

export async function createZendeskTicket(subject: string, body: string, priority?: string): Promise<{ id: number } | null> {
  const token = await getZendeskToken();
  if (!token) return null;
  const res = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets.json`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: { subject, comment: { body }, priority: priority || 'normal' } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.ticket?.id };
}
