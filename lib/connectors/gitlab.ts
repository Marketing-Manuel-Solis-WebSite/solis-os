import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getGitLabToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('gitlab');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function createGitLabIssue(
  projectId: string | number, title: string, description?: string,
): Promise<{ id: number; iid: number; web_url: string } | null> {
  const token = await getGitLabToken();
  if (!token) return null;
  const res = await fetch(`https://gitlab.com/api/v4/projects/${projectId}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description: description || '' }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id, iid: data.iid, web_url: data.web_url };
}

export async function listGitLabProjects(): Promise<{ id: number; name: string; path_with_namespace: string }[]> {
  const token = await getGitLabToken();
  if (!token) return [];
  const res = await fetch('https://gitlab.com/api/v4/projects?membership=true&per_page=30&order_by=updated_at', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((p: any) => ({ id: p.id, name: p.name, path_with_namespace: p.path_with_namespace }));
}
