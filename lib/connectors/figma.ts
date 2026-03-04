import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getFigmaToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('figma');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function listFigmaFiles(teamId: string): Promise<{ key: string; name: string; thumbnail_url: string; last_modified: string }[]> {
  const token = await getFigmaToken();
  if (!token) return [];
  const res = await fetch(`https://api.figma.com/v1/teams/${teamId}/projects`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const files: any[] = [];
  for (const project of data.projects || []) {
    const filesRes = await fetch(`https://api.figma.com/v1/projects/${project.id}/files`, {
      headers: { 'X-Figma-Token': token },
    });
    if (filesRes.ok) {
      const filesData = await filesRes.json();
      files.push(...(filesData.files || []).map((f: any) => ({
        key: f.key, name: f.name, thumbnail_url: f.thumbnail_url || '', last_modified: f.last_modified || '',
      })));
    }
  }
  return files;
}

export async function getFigmaFile(fileKey: string): Promise<{ name: string; lastModified: string; pages: { id: string; name: string }[] } | null> {
  const token = await getFigmaToken();
  if (!token) return null;
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    name: data.name, lastModified: data.lastModified || '',
    pages: (data.document?.children || []).map((p: any) => ({ id: p.id, name: p.name })),
  };
}
