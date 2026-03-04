import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getGithubToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('github');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function createGithubIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
): Promise<{ id: number; number: number; html_url: string } | null> {
  const token = await getGithubToken();
  if (!token) return null;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body: body || '', labels: labels || [] }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return { id: data.id, number: data.number, html_url: data.html_url };
}

export async function listGithubRepos(): Promise<{ id: number; name: string; full_name: string }[]> {
  const token = await getGithubToken();
  if (!token) return [];

  const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
  }));
}
