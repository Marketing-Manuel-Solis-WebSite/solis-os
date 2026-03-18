// ================================================================
// SSO SP Metadata — GET /api/auth/sso/metadata
// ================================================================
// Returns Service Provider SAML metadata XML for IdP configuration.

import { NextResponse } from 'next/server';
import { getSSOConfig } from '@/lib/security/sso-config';

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const config = await getSSOConfig();
  const baseUrl = getBaseUrl(request);
  const acsUrl = `${baseUrl}/api/auth/sso/callback`;
  const entityId = config.entityId || `${baseUrl}/api/auth/sso/metadata`;

  const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${escapeXml(entityId)}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${escapeXml(acsUrl)}"
      index="0"
      isDefault="true" />
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="en">SOLIS OS</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">SOLIS OS</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${escapeXml(baseUrl)}</md:OrganizationURL>
  </md:Organization>
</md:EntityDescriptor>`;

  return new NextResponse(metadata, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': 'attachment; filename="solis-sp-metadata.xml"',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
