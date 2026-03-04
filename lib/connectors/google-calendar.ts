import { decryptToken, encryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';
import { getClientId, getClientSecret, getOAuthConfig } from '../oauth-providers';

async function getGoogleCalendarToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('google_calendar');
  if (!integration?.oauthTokens?.accessToken) return null;

  try {
    // Check if token is expired
    if (integration.oauthTokens.expiresAt && Date.now() > integration.oauthTokens.expiresAt) {
      // Try to refresh
      if (integration.oauthTokens.refreshToken) {
        const refreshed = await refreshGoogleToken(
          decryptToken(integration.oauthTokens.refreshToken),
        );
        if (refreshed) {
          await updateIntegration(integration.id, {
            oauthTokens: {
              ...integration.oauthTokens,
              accessToken: encryptToken(refreshed.accessToken),
              expiresAt: Date.now() + refreshed.expiresIn * 1000,
            },
          });
          return refreshed.accessToken;
        }
      }
      await updateIntegration(integration.id, { status: 'error' });
      return null;
    }

    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  const config = getOAuthConfig('google_calendar');
  if (!config) return null;

  const clientId = getClientId(config);
  const clientSecret = getClientSecret(config);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export async function listCalendarEvents(
  timeMin?: string,
  timeMax?: string,
  maxResults = 20,
): Promise<CalendarEvent[]> {
  const token = await getGoogleCalendarToken();
  if (!token) return [];

  const params = new URLSearchParams({
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: timeMin || new Date().toISOString(),
  });
  if (timeMax) params.set('timeMax', timeMax);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.items || []).map((e: any) => ({
    id: e.id,
    summary: e.summary || '',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || '',
    description: e.description || '',
  }));
}
