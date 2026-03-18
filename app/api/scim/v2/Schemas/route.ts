// ================================================================
// SCIM 2.0 /Schemas — RFC 7644 §4
// Returns the User schema definition.
// ================================================================

import { verifySCIMToken } from '@/lib/security/scim-auth';
import { SCIM_USER_SCHEMA, SCIM_LIST_SCHEMA } from '@/lib/security/scim-adapter';

const SCIM_JSON = 'application/scim+json';

const USER_SCHEMA = {
  id: SCIM_USER_SCHEMA,
  name: 'User',
  description: 'User Account',
  attributes: [
    {
      name: 'userName',
      type: 'string',
      multiValued: false,
      required: true,
      caseExact: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'server',
      description: 'Unique identifier for the User, typically the email address.',
    },
    {
      name: 'name',
      type: 'complex',
      multiValued: false,
      required: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
      description: 'The components of the user\'s real name.',
      subAttributes: [
        {
          name: 'givenName',
          type: 'string',
          multiValued: false,
          required: false,
          caseExact: false,
          mutability: 'readWrite',
          returned: 'default',
          uniqueness: 'none',
          description: 'The given name (first name) of the User.',
        },
        {
          name: 'familyName',
          type: 'string',
          multiValued: false,
          required: false,
          caseExact: false,
          mutability: 'readWrite',
          returned: 'default',
          uniqueness: 'none',
          description: 'The family name (last name) of the User.',
        },
      ],
    },
    {
      name: 'displayName',
      type: 'string',
      multiValued: false,
      required: false,
      caseExact: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
      description: 'The name of the User, suitable for display.',
    },
    {
      name: 'emails',
      type: 'complex',
      multiValued: true,
      required: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
      description: 'Email addresses for the user.',
      subAttributes: [
        {
          name: 'value',
          type: 'string',
          multiValued: false,
          required: false,
          caseExact: false,
          mutability: 'readWrite',
          returned: 'default',
          uniqueness: 'none',
          description: 'Email address value.',
        },
        {
          name: 'type',
          type: 'string',
          multiValued: false,
          required: false,
          caseExact: false,
          mutability: 'readWrite',
          returned: 'default',
          uniqueness: 'none',
          description: 'A label indicating the type of email (e.g., "work").',
        },
        {
          name: 'primary',
          type: 'boolean',
          multiValued: false,
          required: false,
          mutability: 'readWrite',
          returned: 'default',
          uniqueness: 'none',
          description: 'Whether this is the primary email.',
        },
      ],
    },
    {
      name: 'active',
      type: 'boolean',
      multiValued: false,
      required: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
      description: 'Whether the user account is active.',
    },
    {
      name: 'title',
      type: 'string',
      multiValued: false,
      required: false,
      caseExact: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
      description: 'The user\'s title, such as "Vice President".',
    },
    {
      name: 'groups',
      type: 'complex',
      multiValued: true,
      required: false,
      mutability: 'readOnly',
      returned: 'default',
      uniqueness: 'none',
      description: 'Groups the user belongs to (maps to teams).',
      subAttributes: [
        {
          name: 'value',
          type: 'string',
          multiValued: false,
          required: false,
          caseExact: false,
          mutability: 'readOnly',
          returned: 'default',
          uniqueness: 'none',
          description: 'The identifier of the group.',
        },
        {
          name: 'display',
          type: 'string',
          multiValued: false,
          required: false,
          caseExact: false,
          mutability: 'readOnly',
          returned: 'default',
          uniqueness: 'none',
          description: 'A human-readable name for the group.',
        },
      ],
    },
  ],
  meta: {
    resourceType: 'Schema',
    location: '/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User',
  },
};

export async function GET(request: Request) {
  // Schema discovery — allow unauthenticated for IdP configuration
  const token = await verifySCIMToken(request);

  const response = {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: 1,
    startIndex: 1,
    itemsPerPage: 1,
    Resources: [USER_SCHEMA],
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': SCIM_JSON },
  });
}
