// ================================================================
// SCIM 2.0 /ResourceTypes — RFC 7644 §4
// Returns supported resource types (Users only).
// ================================================================

import { verifySCIMToken } from '@/lib/security/scim-auth';
import { SCIM_USER_SCHEMA, SCIM_LIST_SCHEMA } from '@/lib/security/scim-adapter';

const SCIM_JSON = 'application/scim+json';

const USER_RESOURCE_TYPE = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
  id: 'User',
  name: 'User',
  description: 'User Account',
  endpoint: '/scim/v2/Users',
  schema: SCIM_USER_SCHEMA,
  schemaExtensions: [],
  meta: {
    resourceType: 'ResourceType',
    location: '/scim/v2/ResourceTypes/User',
  },
};

export async function GET(request: Request) {
  // Resource type discovery — allow unauthenticated for IdP configuration
  const token = await verifySCIMToken(request);

  const response = {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: 1,
    startIndex: 1,
    itemsPerPage: 1,
    Resources: [USER_RESOURCE_TYPE],
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': SCIM_JSON },
  });
}
