export interface Goal {
  id: string;
  orgId: string;
  name: string;
  description: string;
  dueDate: string | null;
  ownerId: string;
  ownerName: string;
  teamId: string;
  status: GoalStatus;
  progress: number;
  tags: string[];
  color: string;
  visibility: string;
  createdBy: string;
  createdByName: string;
  createdAt: any;
  updatedAt: any;
}

export interface GoalTarget {
  id: string;
  name: string;
  type: TargetType;
  currentValue: number;
  targetValue: number;
  unit: string;
  linkedTaskIds: string[];
  autoSync: boolean;
  createdAt: any;
  updatedAt: any;
}

export type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'completed' | 'cancelled';
export type TargetType = 'number' | 'currency' | 'tasks' | 'percentage' | 'custom';

export const GOAL_STATUSES: { value: GoalStatus; labelKey: string; color: string }[] = [
  { value: 'on_track', labelKey: 'goals.statusOnTrack', color: '#22C55E' },
  { value: 'at_risk', labelKey: 'goals.statusAtRisk', color: '#F59E0B' },
  { value: 'behind', labelKey: 'goals.statusBehind', color: '#EF4444' },
  { value: 'completed', labelKey: 'goals.statusCompleted', color: '#3B82F6' },
  { value: 'cancelled', labelKey: 'goals.statusCancelled', color: '#6B7280' },
];

export const TARGET_TYPES: { value: TargetType; labelKey: string }[] = [
  { value: 'number', labelKey: 'goals.targetTypeNumber' },
  { value: 'currency', labelKey: 'goals.targetTypeCurrency' },
  { value: 'tasks', labelKey: 'goals.targetTypeTasks' },
  { value: 'percentage', labelKey: 'goals.targetTypePercentage' },
  { value: 'custom', labelKey: 'goals.targetTypeCustom' },
];

export const GOAL_COLORS = [
  '#7B68EE', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#06B6D4', '#14B8A6', '#F97316',
];
