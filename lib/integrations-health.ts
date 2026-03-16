// ============================================================
// Integration Health Check — verify connected integrations
// ============================================================

import { getIntegrationByProvider, updateIntegration } from './integrations-db';
import { decryptToken } from './integrations-crypto';
import type { IntegrationProvider, IntegrationStatus } from './integrations-types';

export interface HealthCheckResult {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  latencyMs: number;
  error?: string;
}

/**
 * Check if a connected integration is still healthy
 * by making a lightweight API call to the provider.
 */
export async function checkIntegrationHealth(
  provider: IntegrationProvider,
): Promise<HealthCheckResult> {
  const start = Date.now();
  const integration = await getIntegrationByProvider(provider);

  if (!integration) {
    return { provider, status: 'disconnected', latencyMs: Date.now() - start };
  }

  try {
    const token = integration.oauthTokens?.accessToken
      ? decryptToken(integration.oauthTokens.accessToken)
      : integration.config?.apiKey || null;

    if (!token) {
      return { provider, status: 'error', latencyMs: Date.now() - start, error: 'No credentials found' };
    }

    const ok = await pingProvider(provider, token);
    const status: IntegrationStatus = ok ? 'connected' : 'error';

    // Update integration status in DB
    if (integration.status !== status) {
      await updateIntegration(integration.id, { status }).catch(() => {});
    }

    return { provider, status, latencyMs: Date.now() - start };
  } catch (err: any) {
    const status: IntegrationStatus = 'error';
    await updateIntegration(integration.id, { status }).catch(() => {});
    return { provider, status, latencyMs: Date.now() - start, error: err?.message };
  }
}

/**
 * Check all connected integrations in parallel.
 */
export async function checkAllIntegrationsHealth(
  providers: IntegrationProvider[],
): Promise<HealthCheckResult[]> {
  return Promise.all(providers.map(p => checkIntegrationHealth(p)));
}

// ---- Provider-specific ping functions ----

async function pingProvider(provider: IntegrationProvider, token: string): Promise<boolean> {
  try {
    switch (provider) {
      case 'slack':
        return await pingSlack(token);
      case 'github':
        return await pingGitHub(token);
      case 'google_calendar':
        return await pingGoogleCalendar(token);
      default:
        // For providers without a health endpoint, assume connected if token exists
        return true;
    }
  } catch {
    return false;
  }
}

async function pingSlack(token: string): Promise<boolean> {
  const res = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return data.ok === true;
}

async function pingGitHub(token: string): Promise<boolean> {
  const res = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
  });
  return res.ok;
}

async function pingGoogleCalendar(token: string): Promise<boolean> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.ok;
}

// ---- Provider-specific detailed health checks ----

export interface DetailedHealthResult extends HealthCheckResult {
  details?: Record<string, any>;
}

/**
 * Detailed health check for Slack integration.
 * Checks auth, channels access, and bot info.
 */
export async function checkSlackHealth(): Promise<DetailedHealthResult> {
  const start = Date.now();
  const integration = await getIntegrationByProvider('slack');
  if (!integration) {
    return { provider: 'slack', status: 'disconnected', latencyMs: Date.now() - start };
  }

  try {
    const token = integration.oauthTokens?.accessToken
      ? decryptToken(integration.oauthTokens.accessToken)
      : null;
    if (!token) {
      return { provider: 'slack', status: 'error', latencyMs: Date.now() - start, error: 'No credentials' };
    }

    const authRes = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const authData = await authRes.json();

    if (!authData.ok) {
      return {
        provider: 'slack',
        status: 'error',
        latencyMs: Date.now() - start,
        error: authData.error || 'auth.test failed',
      };
    }

    return {
      provider: 'slack',
      status: 'connected',
      latencyMs: Date.now() - start,
      details: {
        team: authData.team,
        user: authData.user,
        teamId: authData.team_id,
        userId: authData.user_id,
        botId: authData.bot_id,
      },
    };
  } catch (err: any) {
    return { provider: 'slack', status: 'error', latencyMs: Date.now() - start, error: err?.message };
  }
}

/**
 * Detailed health check for GitHub integration.
 * Checks auth and rate limit status.
 */
export async function checkGitHubHealth(): Promise<DetailedHealthResult> {
  const start = Date.now();
  const integration = await getIntegrationByProvider('github');
  if (!integration) {
    return { provider: 'github', status: 'disconnected', latencyMs: Date.now() - start };
  }

  try {
    const token = integration.oauthTokens?.accessToken
      ? decryptToken(integration.oauthTokens.accessToken)
      : null;
    if (!token) {
      return { provider: 'github', status: 'error', latencyMs: Date.now() - start, error: 'No credentials' };
    }

    const [userRes, rateRes] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
      }),
      fetch('https://api.github.com/rate_limit', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
      }),
    ]);

    if (!userRes.ok) {
      return { provider: 'github', status: 'error', latencyMs: Date.now() - start, error: `HTTP ${userRes.status}` };
    }

    const userData = await userRes.json();
    const rateData = rateRes.ok ? await rateRes.json() : null;

    return {
      provider: 'github',
      status: 'connected',
      latencyMs: Date.now() - start,
      details: {
        login: userData.login,
        name: userData.name,
        rateLimit: rateData?.rate ? {
          remaining: rateData.rate.remaining,
          limit: rateData.rate.limit,
          resetsAt: new Date(rateData.rate.reset * 1000).toISOString(),
        } : null,
      },
    };
  } catch (err: any) {
    return { provider: 'github', status: 'error', latencyMs: Date.now() - start, error: err?.message };
  }
}

/**
 * Detailed health check for Google Calendar integration.
 * Checks auth and lists available calendars.
 */
export async function checkGoogleCalendarHealth(): Promise<DetailedHealthResult> {
  const start = Date.now();
  const integration = await getIntegrationByProvider('google_calendar');
  if (!integration) {
    return { provider: 'google_calendar', status: 'disconnected', latencyMs: Date.now() - start };
  }

  try {
    const token = integration.oauthTokens?.accessToken
      ? decryptToken(integration.oauthTokens.accessToken)
      : null;
    if (!token) {
      return { provider: 'google_calendar', status: 'error', latencyMs: Date.now() - start, error: 'No credentials' };
    }

    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=5', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      return {
        provider: 'google_calendar',
        status: 'error',
        latencyMs: Date.now() - start,
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      provider: 'google_calendar',
      status: 'connected',
      latencyMs: Date.now() - start,
      details: {
        calendarCount: data.items?.length || 0,
        primaryCalendar: data.items?.find((c: any) => c.primary)?.summary || 'Unknown',
      },
    };
  } catch (err: any) {
    return { provider: 'google_calendar', status: 'error', latencyMs: Date.now() - start, error: err?.message };
  }
}

/**
 * Run detailed health checks for all key integrations.
 */
export async function checkAllDetailedHealth(): Promise<DetailedHealthResult[]> {
  return Promise.all([
    checkSlackHealth(),
    checkGitHubHealth(),
    checkGoogleCalendarHealth(),
  ]);
}
