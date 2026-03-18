// ================================================================
// SCIM 2.0 /ServiceProviderConfig — RFC 7644 §4
// Declares supported SCIM features and authentication schemes.
// ================================================================

import { verifySCIMToken } from '@/lib/security/scim-auth';

const SCIM_JSON = 'application/scim+json';

export async function GET(request: Request) {
  // ServiceProviderConfig is typically public, but we still validate the token
  // for consistency. Allow unauthenticated access for discovery.
  const token = await verifySCIMToken(request);

  const config = {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://www.rfc-editor.org/rfc/rfc7644',
    patch: {
      supported: true,
    },
    bulk: {
      supported: false,
      maxOperations: 0,
      maxPayloadSize: 0,
    },
    filter: {
      supported: true,
      maxResults: 500,
    },
    changePassword: {
      supported: false,
    },
    sort: {
      supported: false,
    },
    etag: {
      supported: false,
    },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token Standard (RFC 6750). SCIM tokens are issued from the admin panel.',
        specUri: 'https://www.rfc-editor.org/rfc/rfc6750',
        documentationUri: '',
        primary: true,
      },
    ],
    meta: {
      resourceType: 'ServiceProviderConfig',
      location: '/scim/v2/ServiceProviderConfig',
    },
  };

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { 'Content-Type': SCIM_JSON },
  });
}
