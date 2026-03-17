import type { ViewDefinition, UserRole } from '@/types';

const MANAGER_PLUS: UserRole[] = ['owner', 'admin', 'manager'];

export function canSeeView(userId: string, view: ViewDefinition, userRole: UserRole): boolean {
  if (view.visibility === 'private') return view.createdBy === userId;
  if (view.visibility === 'public' || view.visibility === 'required') return true;
  if (view.visibility === 'protected') return MANAGER_PLUS.includes(userRole) || view.createdBy === userId;
  if (view.visibility === 'space_members') return true; // Caller already filters by space membership
  return false;
}

export function canEditView(userId: string, view: ViewDefinition, userRole: UserRole): boolean {
  if (view.createdBy === userId) return true;
  return MANAGER_PLUS.includes(userRole);
}

export function canDeleteView(userId: string, view: ViewDefinition, userRole: UserRole): boolean {
  if (view.createdBy === userId) return true;
  return userRole === 'owner' || userRole === 'admin';
}

export function canProtectView(_userId: string, userRole: UserRole): boolean {
  return MANAGER_PLUS.includes(userRole);
}

export function canSetRequired(_userId: string, userRole: UserRole): boolean {
  return MANAGER_PLUS.includes(userRole);
}
