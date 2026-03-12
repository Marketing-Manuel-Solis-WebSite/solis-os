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

export async function listJiraIssues(
  projectKey: string,
  maxResults = 30,
): Promise<{ id: string; key: string; summary: string; status: string; assignee: string; issueType: string }[]> {
  const token = await getJiraToken();
  if (!token) return [];
  const cloudId = await getCloudId(token);
  if (!cloudId) return [];

  const jql = encodeURIComponent(`project = "${projectKey}" ORDER BY updated DESC`);
  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?jql=${jql}&maxResults=${maxResults}&fields=summary,status,assignee,issuetype`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.issues || []).map((i: any) => ({
    id: i.id,
    key: i.key,
    summary: i.fields?.summary || '',
    status: i.fields?.status?.name || '',
    assignee: i.fields?.assignee?.displayName || '',
    issueType: i.fields?.issuetype?.name || '',
  }));
}

export async function getJiraIssueTransitions(
  issueKey: string,
): Promise<{ id: string; name: string; to: string }[]> {
  const token = await getJiraToken();
  if (!token) return [];
  const cloudId = await getCloudId(token);
  if (!cloudId) return [];

  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.transitions || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    to: t.to?.name || '',
  }));
}

export async function transitionJiraIssue(
  issueKey: string,
  transitionId: string,
): Promise<boolean> {
  const token = await getJiraToken();
  if (!token) return false;
  const cloudId = await getCloudId(token);
  if (!cloudId) return false;

  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: transitionId } }),
    },
  );
  return res.status === 204 || res.ok;
}

export async function addJiraComment(
  issueKey: string,
  body: string,
): Promise<boolean> {
  const token = await getJiraToken();
  if (!token) return false;
  const cloudId = await getCloudId(token);
  if (!cloudId) return false;

  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/comment`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] },
      }),
    },
  );
  return res.ok;
}
