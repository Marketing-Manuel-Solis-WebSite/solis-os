// ================================================================
// SCIM 2.0 Adapter — Maps between internal Member/Firebase User
// and SCIM User resource (RFC 7644 / RFC 7643)
// ================================================================

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

// ---- SCIM Interfaces ----

export interface SCIMUser {
  schemas: string[];
  id: string;
  userName: string;
  displayName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: { value: string; primary: boolean; type: string }[];
  active: boolean;
  groups: { value: string; display: string }[];
  title?: string;
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface SCIMListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: SCIMUser[];
}

export interface SCIMError {
  schemas: string[];
  status: string;
  detail: string;
}

export interface SCIMPatchOp {
  schemas: string[];
  Operations: SCIMPatchOperation[];
}

export interface SCIMPatchOperation {
  op: 'replace' | 'add' | 'remove';
  path?: string;
  value?: unknown;
}

// ---- Mapping Helpers ----

/**
 * Convert an internal member document + Firebase Auth user to a SCIM User.
 */
export function mapMemberToSCIM(
  member: any,
  firebaseUser: { uid: string; email?: string; displayName?: string; disabled?: boolean } | null,
  baseUrl: string,
): SCIMUser {
  const email = member.email || firebaseUser?.email || '';
  const displayName = member.displayName || firebaseUser?.displayName || '';

  // Split display name into given/family for SCIM name component
  const nameParts = displayName.split(' ');
  const givenName = nameParts[0] || '';
  const familyName = nameParts.slice(1).join(' ') || '';

  // Timestamps — handle Firestore admin timestamps
  const createdTs = member.createdAt?._seconds || member.createdAt?.seconds || 0;
  const updatedTs = member.updatedAt?._seconds || member.updatedAt?.seconds || 0;
  const created = createdTs ? new Date(createdTs * 1000).toISOString() : new Date().toISOString();
  const lastModified = updatedTs ? new Date(updatedTs * 1000).toISOString() : created;

  // Teams → SCIM groups
  const teamIds: string[] = member.teamIds || (member.teamId ? [member.teamId] : []);
  const groups = teamIds.filter(Boolean).map((tid: string) => ({
    value: tid,
    display: tid,
  }));

  return {
    schemas: [SCIM_USER_SCHEMA],
    id: member.id || member.userId,
    userName: email,
    displayName,
    name: {
      givenName,
      familyName,
    },
    emails: email
      ? [{ value: email, primary: true, type: 'work' }]
      : [],
    active: member.active !== false && !(firebaseUser?.disabled),
    groups,
    title: member.title || undefined,
    meta: {
      resourceType: 'User',
      created,
      lastModified,
      location: `${baseUrl}/scim/v2/Users/${member.id || member.userId}`,
    },
  };
}

/**
 * Convert a SCIM User payload (from POST/PUT) to internal member creation data.
 * Returns { email, displayName, givenName, familyName, title, active, teamIds }.
 */
export function mapSCIMToMember(scimUser: Partial<SCIMUser>): {
  email: string;
  displayName: string;
  givenName: string;
  familyName: string;
  title: string;
  active: boolean;
  teamIds: string[];
} {
  const email = scimUser.userName
    || scimUser.emails?.find(e => e.primary)?.value
    || scimUser.emails?.[0]?.value
    || '';

  const givenName = scimUser.name?.givenName || '';
  const familyName = scimUser.name?.familyName || '';

  const displayName = scimUser.displayName
    || [givenName, familyName].filter(Boolean).join(' ')
    || email.split('@')[0]
    || '';

  const teamIds = (scimUser.groups || []).map(g => g.value).filter(Boolean);

  return {
    email,
    displayName,
    givenName,
    familyName,
    title: scimUser.title || '',
    active: scimUser.active !== false,
    teamIds,
  };
}

/**
 * Parse a basic SCIM filter string.
 * Supports: userName eq "value" — returns { attribute, operator, value } or null.
 */
export function parseSCIMFilter(
  filter: string,
): { attribute: string; operator: string; value: string } | null {
  if (!filter || !filter.trim()) return null;

  // Pattern: attribute op "value"
  const match = filter.trim().match(/^(\w+)\s+(eq|ne|co|sw|ew)\s+"([^"]*)"$/i);
  if (!match) return null;

  return {
    attribute: match[1],
    operator: match[2].toLowerCase(),
    value: match[3],
  };
}

/**
 * Build a SCIM error response body.
 */
export function scimError(status: number, detail: string): SCIMError {
  return {
    schemas: [SCIM_ERROR_SCHEMA],
    status: String(status),
    detail,
  };
}

/**
 * Build a SCIM list response body.
 */
export function scimListResponse(
  resources: SCIMUser[],
  totalResults: number,
  startIndex: number,
  itemsPerPage: number,
): SCIMListResponse {
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage,
    Resources: resources,
  };
}
