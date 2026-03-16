// ============================================================
// Centralized Org ID — single source of truth.
//
// Currently single-tenant (hardcoded). Multi-tenant support
// reads from auth context / request headers with fallback.
//
// Every file that needs the org ID MUST import from here
// instead of defining its own `const ORG = 'solis-center'`.
// ============================================================

/** The default (and currently only) organization ID. */
export const ORG_ID = 'solis-center';

// ---- Multi-tenant runtime state ----
// When the 'multi-tenant' feature flag is enabled, auth-context
// calls setCurrentOrgId() after login, and all client-side code
// resolves the org via getCurrentOrgId() instead of the constant.

let _currentOrgId: string | null = null;

/**
 * Set the active org ID at runtime (called by auth-context after login).
 * When multi-tenant is off this still works — getCurrentOrgId() simply
 * returns ORG_ID as fallback.
 */
export function setCurrentOrgId(id: string): void {
  _currentOrgId = id;
}

/**
 * Returns the active organization ID.
 * Prefers the runtime value set by auth-context; falls back to ORG_ID.
 */
export function getCurrentOrgId(): string {
  return _currentOrgId || ORG_ID;
}

/**
 * Returns the active organization ID.
 * For now returns the single-tenant constant.
 * Will accept context (e.g. auth session) for multi-tenant.
 * @deprecated Use getCurrentOrgId() instead for multi-tenant readiness.
 */
export function getOrgId(): string {
  return getCurrentOrgId();
}

// ---- Multi-tenant helpers (behind 'multi-tenant' feature flag) ----

/**
 * Extract org ID from an incoming request.
 * Reads `x-org-id` header, falls back to ORG_ID.
 * Server-side only.
 */
export function getOrgIdFromRequest(req: Request): string {
  const header = req.headers.get('x-org-id');
  if (header && typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }
  return ORG_ID;
}

/**
 * Resolve org ID on the client side.
 * Returns getCurrentOrgId() which respects the runtime override
 * set by auth-context when multi-tenant flag is enabled.
 */
export function getOrgIdFromContext(): string {
  return getCurrentOrgId();
}
