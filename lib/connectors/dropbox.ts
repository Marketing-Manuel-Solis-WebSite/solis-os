import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getDropboxToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('dropbox');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export interface DropboxEntry {
  id: string;
  name: string;
  path: string;
  tag: 'file' | 'folder';
  size?: number;
  modified?: string;
}

export async function listDropboxFiles(path = '', limit = 25): Promise<DropboxEntry[]> {
  const token = await getDropboxToken();
  if (!token) return [];
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: path || '', limit }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.entries || []).map((e: any) => ({
    id: e.id, name: e.name, path: e.path_display || e.path_lower, tag: e['.tag'],
    size: e.size, modified: e.server_modified || '',
  }));
}
