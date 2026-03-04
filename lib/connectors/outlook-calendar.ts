import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getOutlookToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('outlook_calendar');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string;
  bodyPreview?: string;
}

export async function listOutlookEvents(
  timeMin?: string, timeMax?: string, maxResults = 20,
): Promise<OutlookCalendarEvent[]> {
  const token = await getOutlookToken();
  if (!token) return [];
  const startDateTime = timeMin || new Date().toISOString();
  const endDateTime = timeMax || new Date(Date.now() + 7 * 86400000).toISOString();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$top=${maxResults}&$orderby=start/dateTime`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.value || []).map((e: any) => ({
    id: e.id, subject: e.subject || '', start: e.start?.dateTime || '', end: e.end?.dateTime || '',
    location: e.location?.displayName || '', bodyPreview: e.bodyPreview || '',
  }));
}
