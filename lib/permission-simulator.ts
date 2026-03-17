// ================================================================
// Permission Simulator — "Who sees what?" engine
// ================================================================
// Simulates effective access for any user across the entire resource
// tree. Returns not just the boolean result, but the full resolution
// trace explaining WHY a user can or cannot access each resource.
//
// This is a pure-logic module with no Firestore calls; all data is
// passed in so the engine is fully testable and can run client-side.

import type { Role, ResourceType, PermAction } from './auth-utils';
import { DEFAULT_PERMS } from './auth-utils';
import type { PermissionOverride, FieldRestriction, ScopedPermission } from './permissions-granular';
import type { CustomRole, ResourceType as CRResourceType, PermAction as CRPermAction } from './custom-roles';

// ---- Types ----

/** Which layer granted or denied the permission */
export type ResolutionSource =
  | 'role-default'
  | 'org-matrix'
  | 'user-override'
  | 'scoped-permission'
  | 'field-restriction'
  | 'space-privacy'
  | 'list-acl'
  | 'doc-visibility'
  | 'custom-role';

export interface ResolutionStep {
  source: ResolutionSource;
  description: string;
  granted: boolean;
}

export interface AccessResult {
  /** Final effective permission */
  granted: boolean;
  /** Ordered list of resolution steps (first match wins) */
  trace: ResolutionStep[];
  /** The source that determined the final result */
  resolvedVia: ResolutionSource;
}

export interface ResourceNode {
  id: string;
  type: 'space' | 'folder' | 'list' | 'task' | 'doc' | 'channel' | 'goal' | 'whiteboard' | 'form' | 'dashboard' | 'automation';
  name: string;
  parentId?: string;
  /** Space-level: privacy setting */
  privacy?: 'public' | 'private' | 'inherited';
  /** Space-level: explicit viewer/editor/manager arrays */
  viewers?: string[];
  editors?: string[];
  managers?: string[];
  /** List-level: ACL override */
  aclMode?: 'inherited' | 'private';
  aclMembers?: string[];
  /** Doc-level: visibility */
  docVisibility?: 'workspace' | 'space' | 'private' | 'public';
  docViewers?: string[];
  docEditors?: string[];
  /** Owner of the resource */
  createdBy?: string;
  /** Space ID this resource belongs to (for scoped lookups) */
  spaceId?: string;
  children?: ResourceNode[];
}

export interface SimulationContext {
  userId: string;
  role: Role;
  teamIds: string[];               // Spaces/teams the user belongs to
  orgMatrix?: Record<string, Record<string, Record<string, boolean>>> | null;
  userOverrides?: PermissionOverride[];
  scopedPermissions?: ScopedPermission[];
  fieldRestrictions?: FieldRestriction[];
  customRole?: CustomRole | null;
}

// ---- Mapping from tree node type to auth ResourceType ----

const NODE_TO_RESOURCE: Record<ResourceNode['type'], ResourceType> = {
  space: 'workspace',
  folder: 'workspace',
  list: 'workspace',
  task: 'task',
  doc: 'doc',
  channel: 'channel',
  goal: 'goal',
  whiteboard: 'whiteboard',
  form: 'form',
  dashboard: 'analytics',
  automation: 'automation',
};

// ---- Core simulation ----

/**
 * Simulate effective access for a single resource + action.
 * Returns the result with full resolution trace.
 */
export function simulateAccess(
  ctx: SimulationContext,
  node: ResourceNode,
  action: PermAction,
): AccessResult {
  const trace: ResolutionStep[] = [];
  const resourceType = NODE_TO_RESOURCE[node.type] || 'workspace';

  // ── Step 1: User overrides (highest priority) ──
  if (ctx.userOverrides?.length) {
    const override = ctx.userOverrides.find(
      o => o.resource === resourceType && o.action === action,
    );
    if (override !== undefined) {
      const step: ResolutionStep = {
        source: 'user-override',
        description: override.granted
          ? `Explicit user override grants "${action}" on "${resourceType}"${override.reason ? `: ${override.reason}` : ''}`
          : `Explicit user override denies "${action}" on "${resourceType}"${override.reason ? `: ${override.reason}` : ''}`,
        granted: override.granted,
      };
      trace.push(step);
      return { granted: override.granted, trace, resolvedVia: 'user-override' };
    }
    trace.push({
      source: 'user-override',
      description: `No user override for "${action}" on "${resourceType}"`,
      granted: false, // not deterministic, just skipped
    });
  }

  // ── Step 2: Scoped permissions (space/team level) ──
  if (ctx.scopedPermissions?.length && node.spaceId) {
    const scoped = ctx.scopedPermissions.find(
      s =>
        s.resource === resourceType &&
        s.action === action &&
        s.scope === 'space' &&
        s.scopeId === node.spaceId,
    );
    if (scoped !== undefined) {
      const step: ResolutionStep = {
        source: 'scoped-permission',
        description: scoped.granted
          ? `Space-scoped permission grants "${action}" on "${resourceType}" in space "${node.spaceId}"`
          : `Space-scoped permission denies "${action}" on "${resourceType}" in space "${node.spaceId}"`,
        granted: scoped.granted,
      };
      trace.push(step);
      return { granted: scoped.granted, trace, resolvedVia: 'scoped-permission' };
    }
  }

  // ── Step 3: Custom role (if assigned) ──
  if (ctx.customRole) {
    const crResource = resourceType as unknown as CRResourceType;
    const crAction = action as unknown as CRPermAction;
    const perm = ctx.customRole.permissions?.[crResource]?.[crAction];
    if (perm !== undefined) {
      trace.push({
        source: 'custom-role',
        description: perm
          ? `Custom role "${ctx.customRole.name}" grants "${action}" on "${resourceType}"`
          : `Custom role "${ctx.customRole.name}" denies "${action}" on "${resourceType}"`,
        granted: perm,
      });
      return { granted: perm, trace, resolvedVia: 'custom-role' };
    }
  }

  // ── Step 4: Space privacy check ──
  if (node.type === 'space' && node.privacy === 'private') {
    const isMember = ctx.teamIds.includes(node.id);
    const isViewer = node.viewers?.includes(ctx.userId) ?? false;
    const isEditor = node.editors?.includes(ctx.userId) ?? false;
    const isManager = node.managers?.includes(ctx.userId) ?? false;
    const hasAccess = isMember || isViewer || isEditor || isManager;

    if (!hasAccess && ctx.role !== 'owner' && ctx.role !== 'admin') {
      trace.push({
        source: 'space-privacy',
        description: `Space "${node.name}" is private and user is not a member, viewer, editor, or manager`,
        granted: false,
      });
      return { granted: false, trace, resolvedVia: 'space-privacy' };
    }
    trace.push({
      source: 'space-privacy',
      description: hasAccess
        ? `Space "${node.name}" is private but user has explicit access`
        : `Space "${node.name}" is private but user is ${ctx.role} (admin override)`,
      granted: true,
    });
  }

  // ── Step 4b: Inherited space privacy for child nodes ──
  if (node.type !== 'space' && node.spaceId && !ctx.teamIds.includes(node.spaceId)) {
    if (ctx.role !== 'owner' && ctx.role !== 'admin') {
      // Check if node type has its own access (list ACL, doc visibility)
      // If not, block because parent space is not accessible
      const hasOwnAccess = checkNodeSpecificAccess(ctx, node);
      if (!hasOwnAccess) {
        trace.push({
          source: 'space-privacy',
          description: `User is not a member of the parent space and has no direct access to this ${node.type}`,
          granted: false,
        });
        return { granted: false, trace, resolvedVia: 'space-privacy' };
      }
    }
  }

  // ── Step 5: List ACL check ──
  if (node.type === 'list' && node.aclMode === 'private') {
    const hasListAccess = node.aclMembers?.includes(ctx.userId) ?? false;
    if (!hasListAccess && ctx.role !== 'owner' && ctx.role !== 'admin') {
      trace.push({
        source: 'list-acl',
        description: `List "${node.name}" has private ACL and user is not in the access list`,
        granted: false,
      });
      return { granted: false, trace, resolvedVia: 'list-acl' };
    }
    if (hasListAccess) {
      trace.push({
        source: 'list-acl',
        description: `User is in list "${node.name}" private ACL`,
        granted: true,
      });
    }
  }

  // ── Step 5b: Task inherits list ACL ──
  // (handled by parent traversal in tree simulation)

  // ── Step 6: Doc visibility check ──
  if (node.type === 'doc' && node.docVisibility) {
    if (node.docVisibility === 'private') {
      const isDocViewer = node.docViewers?.includes(ctx.userId) ?? false;
      const isDocEditor = node.docEditors?.includes(ctx.userId) ?? false;
      const isCreator = node.createdBy === ctx.userId;
      const hasDocAccess = isDocViewer || isDocEditor || isCreator;

      if (!hasDocAccess && ctx.role !== 'owner' && ctx.role !== 'admin') {
        trace.push({
          source: 'doc-visibility',
          description: `Doc "${node.name}" is private and user is not a viewer, editor, or creator`,
          granted: false,
        });
        return { granted: false, trace, resolvedVia: 'doc-visibility' };
      }
      if (hasDocAccess) {
        trace.push({
          source: 'doc-visibility',
          description: `User has explicit access to private doc "${node.name}"`,
          granted: true,
        });
      }
    }
  }

  // ── Step 7: Org-level custom matrix ──
  if (ctx.orgMatrix?.[ctx.role]?.[resourceType]?.[action] !== undefined) {
    const granted = !!ctx.orgMatrix[ctx.role][resourceType][action];
    trace.push({
      source: 'org-matrix',
      description: granted
        ? `Org permission matrix grants "${action}" on "${resourceType}" for role "${ctx.role}"`
        : `Org permission matrix denies "${action}" on "${resourceType}" for role "${ctx.role}"`,
      granted,
    });
    return { granted, trace, resolvedVia: 'org-matrix' };
  }

  // ── Step 8: Role defaults (lowest priority) ──
  const roleDefault = DEFAULT_PERMS[ctx.role]?.[resourceType]?.[action] ?? false;
  trace.push({
    source: 'role-default',
    description: roleDefault
      ? `Default role "${ctx.role}" grants "${action}" on "${resourceType}"`
      : `Default role "${ctx.role}" does not grant "${action}" on "${resourceType}"`,
    granted: roleDefault,
  });
  return { granted: roleDefault, trace, resolvedVia: 'role-default' };
}

/**
 * Check if a node has its own access mechanism that could override
 * the lack of parent space membership.
 */
function checkNodeSpecificAccess(ctx: SimulationContext, node: ResourceNode): boolean {
  // List with ACL that includes user
  if (node.type === 'list' && node.aclMode === 'private') {
    return node.aclMembers?.includes(ctx.userId) ?? false;
  }
  // Doc with explicit viewer/editor access
  if (node.type === 'doc' && node.docVisibility === 'private') {
    return (
      (node.docViewers?.includes(ctx.userId) ?? false) ||
      (node.docEditors?.includes(ctx.userId) ?? false) ||
      node.createdBy === ctx.userId
    );
  }
  return false;
}

// ---- Field-level simulation ----

export interface FieldAccessResult {
  canEdit: boolean;
  trace: ResolutionStep[];
}

/**
 * Simulate whether a user can edit a specific field on a resource.
 */
export function simulateFieldAccess(
  ctx: SimulationContext,
  resourceType: ResourceType,
  fieldName: string,
): FieldAccessResult {
  const trace: ResolutionStep[] = [];
  const restrictions = ctx.fieldRestrictions || [];
  const restriction = restrictions.find(
    r => r.resource === resourceType && r.field === fieldName,
  );

  if (!restriction) {
    trace.push({
      source: 'field-restriction',
      description: `No restriction on field "${fieldName}" — anyone with update permission can edit`,
      granted: true,
    });
    return { canEdit: true, trace };
  }

  if (restriction.allowedRoles.includes(ctx.role)) {
    trace.push({
      source: 'field-restriction',
      description: `Role "${ctx.role}" is allowed to edit field "${fieldName}" on "${resourceType}"`,
      granted: true,
    });
    return { canEdit: true, trace };
  }

  if (restriction.allowedUsers?.includes(ctx.userId)) {
    trace.push({
      source: 'field-restriction',
      description: `User is explicitly allowed to edit field "${fieldName}" on "${resourceType}"`,
      granted: true,
    });
    return { canEdit: true, trace };
  }

  trace.push({
    source: 'field-restriction',
    description: `Role "${ctx.role}" cannot edit field "${fieldName}" on "${resourceType}" — allowed roles: ${restriction.allowedRoles.join(', ')}`,
    granted: false,
  });
  return { canEdit: false, trace };
}

// ---- Tree simulation ----

export interface TreeAccessResult {
  node: ResourceNode;
  read: AccessResult;
  write: AccessResult;
  delete: AccessResult;
  children: TreeAccessResult[];
}

/**
 * Simulate access for an entire resource tree recursively.
 * Returns a mirrored tree with access results at each node.
 */
export function simulateTree(
  ctx: SimulationContext,
  nodes: ResourceNode[],
): TreeAccessResult[] {
  return nodes.map(node => ({
    node,
    read: simulateAccess(ctx, node, 'read'),
    write: simulateAccess(ctx, node, 'update'),
    delete: simulateAccess(ctx, node, 'delete'),
    children: node.children ? simulateTree(ctx, node.children) : [],
  }));
}

// ---- "What if" helper ----

/**
 * Create a modified context to simulate role changes.
 * Useful for "what if this user were a manager?" previews.
 */
export function withRole(ctx: SimulationContext, newRole: Role): SimulationContext {
  return { ...ctx, role: newRole };
}

/**
 * Create a modified context to simulate adding the user to a space.
 */
export function withSpaceAccess(ctx: SimulationContext, spaceId: string): SimulationContext {
  if (ctx.teamIds.includes(spaceId)) return ctx;
  return { ...ctx, teamIds: [...ctx.teamIds, spaceId] };
}

// ---- Summary helpers ----

export interface AccessSummary {
  total: number;
  readable: number;
  writable: number;
  deletable: number;
  denied: number;
}

/**
 * Compute a flat summary from a tree simulation result.
 */
export function summarizeTree(results: TreeAccessResult[]): AccessSummary {
  const summary: AccessSummary = { total: 0, readable: 0, writable: 0, deletable: 0, denied: 0 };

  function walk(items: TreeAccessResult[]) {
    for (const item of items) {
      summary.total++;
      if (item.read.granted) summary.readable++;
      if (item.write.granted) summary.writable++;
      if (item.delete.granted) summary.deletable++;
      if (!item.read.granted) summary.denied++;
      walk(item.children);
    }
  }

  walk(results);
  return summary;
}
