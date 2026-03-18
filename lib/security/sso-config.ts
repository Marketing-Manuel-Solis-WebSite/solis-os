// ================================================================
// SSO Configuration — SAML 2.0 & OpenID Connect
// ================================================================
// Stored at: orgs/{orgId}/settings/sso
// Uses Firebase Admin SDK for server-side reads/writes.

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';

export interface SSOConfig {
  enabled: boolean;
  provider: 'saml' | 'oidc';
  providerName: string;

  // SAML fields
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;

  // OIDC fields
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;

  // Shared
  attributeMapping: {
    email: string;
    displayName: string;
    role?: string;
  };
  autoProvision: boolean;
  defaultRole: string;
  allowedDomains: string[];
}

const DEFAULT_CONFIG: SSOConfig = {
  enabled: false,
  provider: 'oidc',
  providerName: '',
  attributeMapping: {
    email: 'email',
    displayName: 'name',
  },
  autoProvision: false,
  defaultRole: 'member',
  allowedDomains: [],
};

/**
 * Read SSO config from Firestore using Admin SDK.
 */
export async function getSSOConfig(): Promise<SSOConfig> {
  try {
    const snap = await adminDb.doc(`orgs/${ORG}/settings/sso`).get();
    if (!snap.exists) return { ...DEFAULT_CONFIG };
    const data = snap.data() as Partial<SSOConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...data,
      attributeMapping: {
        ...DEFAULT_CONFIG.attributeMapping,
        ...(data.attributeMapping || {}),
      },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save SSO config to Firestore.
 */
export async function saveSSOConfig(config: SSOConfig, userId: string): Promise<void> {
  await adminDb.doc(`orgs/${ORG}/settings/sso`).set(
    {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    },
    { merge: true },
  );
}

/**
 * Validate SSO config has all required fields for the selected provider.
 * Returns an array of error messages (empty = valid).
 */
export function validateSSOConfig(config: SSOConfig): string[] {
  const errors: string[] = [];

  if (!config.providerName?.trim()) {
    errors.push('Provider name is required');
  }

  if (config.provider === 'saml') {
    if (!config.entityId?.trim()) errors.push('Entity ID is required for SAML');
    if (!config.ssoUrl?.trim()) errors.push('SSO URL is required for SAML');
    if (!config.certificate?.trim()) errors.push('Certificate is required for SAML');
  }

  if (config.provider === 'oidc') {
    if (!config.clientId?.trim()) errors.push('Client ID is required for OIDC');
    if (!config.clientSecret?.trim()) errors.push('Client Secret is required for OIDC');
    if (!config.issuer?.trim() && !config.discoveryUrl?.trim()) {
      errors.push('Either Issuer or Discovery URL is required for OIDC');
    }
  }

  if (!config.attributeMapping?.email?.trim()) {
    errors.push('Email attribute mapping is required');
  }

  if (config.allowedDomains.length > 0) {
    for (const domain of config.allowedDomains) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(domain)) {
        errors.push(`Invalid domain: ${domain}`);
      }
    }
  }

  return errors;
}
