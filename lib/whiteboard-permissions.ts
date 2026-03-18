// ================================================================
// Whiteboard Permissions — Granular access control for whiteboards
// ================================================================
// Mirrors the Doc permissions pattern: visibility levels + explicit
// viewer/editor arrays. Falls back to space membership for 'workspace'
// and 'space' visibility levels.

import type { WhiteboardPermissions, WhiteboardVisibility } from '@/components/whiteboards/constants';

export const DEFAULT_WHITEBOARD_PERMISSIONS: WhiteboardPermissions = {
  visibility: 'workspace',
  viewers: [],
  editors: [],
};

/**
 * Check if a user can view a whiteboard.
 */
export function canViewWhiteboard(
  wb: { createdBy: string; teamId?: string; permissions?: WhiteboardPermissions; members?: string[] },
  userId: string,
  userRole: string,
  userTeamIds: string[],
): boolean {
  // Owner/admin always can view
  if (userRole === 'owner' || userRole === 'admin') return true;

  // Creator always can view
  if (wb.createdBy === userId) return true;

  const perms = wb.permissions || DEFAULT_WHITEBOARD_PERMISSIONS;

  switch (perms.visibility) {
    case 'workspace':
      // Everyone in the org can view
      return true;

    case 'space':
      // Only space members can view
      if (wb.teamId && userTeamIds.includes(wb.teamId)) return true;
      // Or explicit viewer/editor
      return perms.viewers.includes(userId) || perms.editors.includes(userId);

    case 'private':
      // Only explicit viewers/editors and legacy members
      return (
        perms.viewers.includes(userId) ||
        perms.editors.includes(userId) ||
        (wb.members || []).includes(userId)
      );

    default:
      return true;
  }
}

/**
 * Check if a user can edit a whiteboard.
 */
export function canEditWhiteboard(
  wb: { createdBy: string; teamId?: string; permissions?: WhiteboardPermissions; members?: string[] },
  userId: string,
  userRole: string,
  userTeamIds: string[],
): boolean {
  // Owner/admin always can edit
  if (userRole === 'owner' || userRole === 'admin') return true;

  // Creator always can edit
  if (wb.createdBy === userId) return true;

  const perms = wb.permissions || DEFAULT_WHITEBOARD_PERMISSIONS;

  // Explicit editors can always edit
  if (perms.editors.includes(userId)) return true;

  // For workspace visibility, space members with member+ role can edit
  if (perms.visibility === 'workspace' || perms.visibility === 'space') {
    if (wb.teamId && userTeamIds.includes(wb.teamId)) {
      return userRole === 'manager' || userRole === 'member';
    }
  }

  return false;
}

/**
 * Share a whiteboard with specific users.
 */
export function addWhiteboardViewers(
  currentPerms: WhiteboardPermissions,
  userIds: string[],
): WhiteboardPermissions {
  const viewers = new Set([...currentPerms.viewers, ...userIds]);
  return { ...currentPerms, viewers: Array.from(viewers) };
}

export function addWhiteboardEditors(
  currentPerms: WhiteboardPermissions,
  userIds: string[],
): WhiteboardPermissions {
  const editors = new Set([...currentPerms.editors, ...userIds]);
  return { ...currentPerms, editors: Array.from(editors) };
}

export function removeWhiteboardAccess(
  currentPerms: WhiteboardPermissions,
  userId: string,
): WhiteboardPermissions {
  return {
    ...currentPerms,
    viewers: currentPerms.viewers.filter(id => id !== userId),
    editors: currentPerms.editors.filter(id => id !== userId),
  };
}

export function setWhiteboardVisibility(
  currentPerms: WhiteboardPermissions,
  visibility: WhiteboardVisibility,
): WhiteboardPermissions {
  return { ...currentPerms, visibility };
}
