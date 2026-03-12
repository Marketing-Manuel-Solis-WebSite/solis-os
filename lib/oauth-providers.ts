export interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
}

export const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  // ─── Communication ──────────────────────────
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'chat:write', 'users:read'],
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
  },
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scopes: ['bot', 'guilds', 'identify'],
    clientIdEnv: 'DISCORD_CLIENT_ID',
    clientSecretEnv: 'DISCORD_CLIENT_SECRET',
  },
  teams: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://graph.microsoft.com/Chat.ReadWrite', 'https://graph.microsoft.com/Team.ReadBasic.All', 'offline_access'],
    clientIdEnv: 'TEAMS_CLIENT_ID',
    clientSecretEnv: 'TEAMS_CLIENT_SECRET',
  },

  // ─── Development ────────────────────────────
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'user:email'],
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
  },
  gitlab: {
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    scopes: ['api', 'read_user', 'read_repository'],
    clientIdEnv: 'GITLAB_CLIENT_ID',
    clientSecretEnv: 'GITLAB_CLIENT_SECRET',
  },
  jira: {
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'offline_access'],
    clientIdEnv: 'JIRA_CLIENT_ID',
    clientSecretEnv: 'JIRA_CLIENT_SECRET',
  },

  // ─── Calendar ───────────────────────────────
  google_calendar: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  outlook_calendar: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'offline_access'],
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
  },

  // ─── Storage ────────────────────────────────
  google_drive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scopes: [],
    clientIdEnv: 'DROPBOX_CLIENT_ID',
    clientSecretEnv: 'DROPBOX_CLIENT_SECRET',
  },
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://graph.microsoft.com/Files.ReadWrite', 'offline_access'],
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
  },

  // ─── CRM ────────────────────────────────────
  hubspot: {
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read'],
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
  },
  zendesk: {
    authUrl: 'https://d3v-soliscenter.zendesk.com/oauth/authorizations/new',
    tokenUrl: 'https://d3v-soliscenter.zendesk.com/oauth/tokens',
    scopes: ['read', 'write'],
    clientIdEnv: 'ZENDESK_CLIENT_ID',
    clientSecretEnv: 'ZENDESK_CLIENT_SECRET',
  },
  intercom: {
    authUrl: 'https://app.intercom.com/oauth',
    tokenUrl: 'https://api.intercom.io/auth/eagle/token',
    scopes: [],
    clientIdEnv: 'INTERCOM_CLIENT_ID',
    clientSecretEnv: 'INTERCOM_CLIENT_SECRET',
  },

  // ─── Design / Productivity ──────────────────
  figma: {
    authUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://api.figma.com/v1/oauth/token',
    scopes: ['files:read'],
    clientIdEnv: 'FIGMA_CLIENT_ID',
    clientSecretEnv: 'FIGMA_CLIENT_SECRET',
  },
  notion: {
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    clientIdEnv: 'NOTION_CLIENT_ID',
    clientSecretEnv: 'NOTION_CLIENT_SECRET',
  },
  airtable: {
    authUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
    scopes: ['data.records:read', 'data.records:write', 'schema.bases:read'],
    clientIdEnv: 'AIRTABLE_CLIENT_ID',
    clientSecretEnv: 'AIRTABLE_CLIENT_SECRET',
  },
};

export function getOAuthConfig(provider: string): OAuthConfig | null {
  return OAUTH_CONFIGS[provider] || null;
}

export function getClientId(config: OAuthConfig): string {
  return process.env[config.clientIdEnv] || '';
}

export function getClientSecret(config: OAuthConfig): string {
  return process.env[config.clientSecretEnv] || '';
}

function ensureProtocol(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export function buildAuthUrl(provider: string, state: string): string | null {
  const config = getOAuthConfig(provider);
  if (!config) return null;

  const clientId = getClientId(config);
  if (!clientId) return null;

  const appUrl = ensureProtocol(process.env.NEXT_PUBLIC_APP_URL || '');
  const redirectUri = `${appUrl}/api/oauth/${provider}/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state,
    response_type: 'code',
  });

  // Google needs access_type=offline for refresh tokens
  if (provider === 'google_calendar' || provider === 'google_drive') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  // Discord needs permissions param for bot scope
  if (provider === 'discord') {
    params.set('permissions', '2048');
  }

  // Jira uses audience param
  if (provider === 'jira') {
    params.set('audience', 'api.atlassian.com');
    params.set('prompt', 'consent');
  }

  // Notion uses owner=user
  if (provider === 'notion') {
    params.delete('scope');
    params.set('owner', 'user');
  }

  // Airtable uses PKCE with code_challenge
  if (provider === 'airtable') {
    params.set('code_challenge_method', 'plain');
    params.set('code_challenge', state);
  }

  // Dropbox needs token_access_type for refresh
  if (provider === 'dropbox') {
    params.delete('scope');
    params.set('token_access_type', 'offline');
  }

  return `${config.authUrl}?${params.toString()}`;
}

export async function exchangeCode(
  provider: string,
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string } | null> {
  const config = getOAuthConfig(provider);
  if (!config) return null;

  const clientId = getClientId(config);
  const clientSecret = getClientSecret(config);
  if (!clientId || !clientSecret) return null;

  const appUrl = ensureProtocol(process.env.NEXT_PUBLIC_APP_URL || '');
  const redirectUri = `${appUrl}/api/oauth/${provider}/callback`;

  const body: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  };

  // GitHub doesn't need grant_type
  if (provider !== 'github') {
    body.grant_type = 'authorization_code';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // GitHub requires Accept: application/json
  if (provider === 'github') {
    headers['Accept'] = 'application/json';
  }

  // Notion requires Basic auth header
  if (provider === 'notion') {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
    headers['Content-Type'] = 'application/json';

    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accessToken: data.access_token || '',
      refreshToken: '',
      expiresIn: 0,
      scope: '',
    };
  }

  // Airtable uses Basic auth
  if (provider === 'airtable') {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
    delete body.client_id;
    delete body.client_secret;
    body.code_verifier = new URL(`${appUrl}/api/oauth/${provider}/callback`).searchParams.get('state') || '';
  }

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) return null;

  const data = await res.json();

  return {
    accessToken: data.access_token || data.authed_user?.access_token || '',
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in || 0,
    scope: data.scope || config.scopes.join(' '),
  };
}
