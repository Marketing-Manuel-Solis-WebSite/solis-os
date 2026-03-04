import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getDriveToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('google_drive');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
  modifiedTime: string;
}

export async function listDriveFiles(query?: string, maxResults = 20): Promise<DriveFile[]> {
  const token = await getDriveToken();
  if (!token) return [];
  const params = new URLSearchParams({ pageSize: String(maxResults), fields: 'files(id,name,mimeType,webViewLink,iconLink,modifiedTime)', orderBy: 'modifiedTime desc' });
  if (query) params.set('q', `name contains '${query}'`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id, name: f.name, mimeType: f.mimeType, webViewLink: f.webViewLink || '', iconLink: f.iconLink || '', modifiedTime: f.modifiedTime || '',
  }));
}
