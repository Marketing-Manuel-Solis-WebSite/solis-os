import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getJiraToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('jira');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

async function getCloudId(token: string): Promise<string | null> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data[0]?.id || null;
}

export async function createJiraIssue(
  projectKey: string, summary: string, description?: string, issueType?: string,
): Promise<{ id: string; key: string; self: string } | null> {
  const token = await getJiraToken();
  if (!token) return null;
  const cloudId = await getCloudId(token);
  if (!cloudId) return null;
  const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description || '' }] }] },
        issuetype: { name: issueType || 'Task' },
      },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id, key: data.key, self: data.self };
}

export async function listJiraProjects(): Promise<{ id: string; key: string; name: string }[]> {
  const token = await getJiraToken();
  if (!token) return [];
  const cloudId = await getCloudId(token);
  if (!cloudId) return [];
  const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((p: any) => ({ id: p.id, key: p.key, name: p.name }));
}
