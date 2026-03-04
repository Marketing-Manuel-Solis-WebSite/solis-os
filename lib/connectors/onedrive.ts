import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getOneDriveToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('onedrive');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export interface OneDriveItem {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  lastModified: string;
  isFolder: boolean;
}

export async function listOneDriveFiles(folderId?: string, top = 25): Promise<OneDriveItem[]> {
  const token = await getOneDriveToken();
  if (!token) return [];
  const path = folderId ? `/me/drive/items/${folderId}/children` : '/me/drive/root/children';
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}?$top=${top}&$orderby=lastModifiedDateTime desc`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.value || []).map((i: any) => ({
    id: i.id, name: i.name, webUrl: i.webUrl || '', size: i.size || 0,
    lastModified: i.lastModifiedDateTime || '', isFolder: !!i.folder,
  }));
}
