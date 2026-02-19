import { Timestamp } from 'firebase/firestore';

// ============================================
// CORE TYPES - SOLIS CENTER
// ============================================

// --- Base ---
export type FirestoreTimestamp = Timestamp;

export interface BaseEntity {
  id: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  createdBy: string;
}

// --- Roles & Permissions ---
export type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'guest' | 'readonly';

export interface Permission {
  resource: ResourceType;
  actions: PermissionAction[];
}

export type ResourceType =
  | 'workspace' | 'space' | 'folder' | 'list' | 'task'
  | 'doc' | 'channel' | 'automation' | 'analytics'
  | 'admin' | 'audit' | 'integration' | 'user' | 'org';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'export';

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  orgId: string;
}

// --- Organization ---
export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  logo?: string;
  branding: OrgBranding;
  settings: OrgSettings;
  plan: OrgPlan;
  domains: string[];
}

export interface OrgBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface OrgSettings {
  timezone: string;
  dateFormat: string;
  weekStartsOn: 0 | 1;
  defaultLanguage: string;
  retentionDays: number;
  features: FeatureFlags;
}

export interface FeatureFlags {
  aiEnabled: boolean;
  automationsEnabled: boolean;
  crmEnabled: boolean;
  chatEnabled: boolean;
  docsEnabled: boolean;
  analyticsEnabled: boolean;
  orgChartEnabled: boolean;
  integrationsEnabled: boolean;
}

export interface OrgPlan {
  type: 'free' | 'pro' | 'enterprise';
  maxUsers: number;
  maxStorageGB: number;
  maxWorkspaces: number;
}

// --- Users & Memberships ---
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  title?: string;
  department?: string;
  bio?: string;
  signature?: string;
  preferences: UserPreferences;
  lastActiveAt: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
  defaultView: 'list' | 'board' | 'calendar' | 'table';
  compactMode: boolean;
  timezone?: string;
}

export interface NotificationPreferences {
  email: boolean;
  emailDigest: 'none' | 'daily' | 'weekly';
  inApp: boolean;
  assignments: boolean;
  mentions: boolean;
  dueSoon: boolean;
  automationOutcomes: boolean;
  weeklyReport: boolean;
}

export interface Membership extends BaseEntity {
  orgId: string;
  userId: string;
  role: UserRole;
  teams: string[];
  title: string;
  managerId?: string;
  active: boolean;
  invitedBy?: string;
  joinedAt?: FirestoreTimestamp;
}

export interface Invitation extends BaseEntity {
  orgId: string;
  email: string;
  role: UserRole;
  teams: string[];
  expiresAt: FirestoreTimestamp;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedBy: string;
}

// --- Workspace Hierarchy ---
export interface Workspace extends BaseEntity {
  orgId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  settings: WorkspaceSettings;
  order: number;
  visibility: 'public' | 'private';
}

export interface WorkspaceSettings {
  defaultView: string;
  statuses: StatusConfig[];
  priorities: PriorityConfig[];
}

export interface StatusConfig {
  id: string;
  name: string;
  color: string;
  type: 'open' | 'active' | 'done' | 'closed';
  order: number;
  isLocked?: boolean;
}

export interface PriorityConfig {
  id: string;
  name: string;
  color: string;
  level: number;
}

export interface Space extends BaseEntity {
  workspaceId: string;
  orgId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  privacy: 'public' | 'private' | 'inherited';
  permissions: SpacePermissions;
  order: number;
}

export interface SpacePermissions {
  viewers: string[];
  editors: string[];
  managers: string[];
}

export interface Folder extends BaseEntity {
  spaceId: string;
  workspaceId: string;
  orgId: string;
  name: string;
  order: number;
  parentFolderId?: string;
}

export interface TaskList extends BaseEntity {
  folderId?: string;
  spaceId: string;
  workspaceId: string;
  orgId: string;
  name: string;
  description?: string;
  statuses: StatusConfig[];
  customFieldsSchema: CustomFieldSchema[];
  order: number;
  settings: ListSettings;
}

export interface ListSettings {
  defaultStatus?: string;
  defaultAssignee?: string;
  taskTemplate?: string;
  autoClose?: boolean;
  closedStatusId?: string;
}

// --- Tasks ---
export interface Task extends BaseEntity {
  orgId: string;
  workspaceId: string;
  spaceId: string;
  folderId?: string;
  listId: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  status: string;
  priority: string;
  assignees: string[];
  watchers: string[];
  dueDate?: FirestoreTimestamp;
  startDate?: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp;
  tags: string[];
  customFields: Record<string, unknown>;
  dependencies: TaskDependency[];
  parentTaskId?: string;
  subtaskIds: string[];
  checklistItems: ChecklistItem[];
  timeEstimate?: number;
  timeTracked: number;
  recurrence?: RecurrenceConfig;
  attachments: Attachment[];
  order: number;
  archived: boolean;
}

export interface TaskDependency {
  taskId: string;
  type: 'blocks' | 'blocked_by' | 'related';
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  order: number;
}

export interface RecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: FirestoreTimestamp;
  endAfter?: number;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: FirestoreTimestamp;
}

export interface TaskComment extends BaseEntity {
  taskId: string;
  content: string;
  contentHtml?: string;
  mentions: string[];
  attachments: Attachment[];
  parentCommentId?: string;
  edited: boolean;
}

export interface TaskActivity extends BaseEntity {
  taskId: string;
  actorId: string;
  action: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

// --- Custom Fields ---
export type CustomFieldType =
  | 'text' | 'number' | 'currency' | 'date'
  | 'select' | 'multi_select' | 'checkbox'
  | 'url' | 'email' | 'phone' | 'formula';

export interface CustomFieldSchema {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options?: SelectOption[];
  validation?: FieldValidation;
  defaultValue?: unknown;
  formula?: string;
  order: number;
}

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  regex?: string;
  minLength?: number;
  maxLength?: number;
}

// --- Docs ---
export interface Doc extends BaseEntity {
  orgId: string;
  workspaceId: string;
  folderId?: string;
  parentDocId?: string;
  title: string;
  content: string;
  contentHtml?: string;
  permissions: DocPermissions;
  tags: string[];
  isTemplate: boolean;
  templateVars?: string[];
  version: number;
  lastEditedBy: string;
  archived: boolean;
}

export interface DocPermissions {
  visibility: 'workspace' | 'space' | 'private' | 'public';
  viewers: string[];
  editors: string[];
}

export interface DocRevision extends BaseEntity {
  docId: string;
  content: string;
  version: number;
  editedBy: string;
  changeNote?: string;
}

// --- Chat / Messaging ---
export interface Channel extends BaseEntity {
  orgId: string;
  workspaceId: string;
  name: string;
  description?: string;
  privacy: 'public' | 'private' | 'dm';
  members: string[];
  pinnedMessages: string[];
  archived: boolean;
}

export interface Message extends BaseEntity {
  channelId: string;
  content: string;
  contentHtml?: string;
  mentions: string[];
  attachments: Attachment[];
  reactions: Record<string, string[]>;
  threadId?: string;
  replyCount: number;
  edited: boolean;
  deleted: boolean;
}

// --- Automations ---
export type TriggerType =
  | 'task_created' | 'task_updated' | 'task_status_changed'
  | 'task_assignee_changed' | 'task_due_date_reached'
  | 'task_due_date_approaching' | 'doc_updated'
  | 'message_mention' | 'webhook_received'
  | 'schedule_daily' | 'schedule_weekly' | 'schedule_monthly';

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in';

export type ActionType =
  | 'assign_user' | 'change_status' | 'set_due_date' | 'set_priority'
  | 'add_tag' | 'remove_tag' | 'create_subtask' | 'move_to_list'
  | 'post_comment' | 'send_email' | 'send_webhook'
  | 'create_doc' | 'post_message' | 'generate_ai_summary'
  | 'create_task';

export interface AutomationRule extends BaseEntity {
  orgId: string;
  scope: AutomationScope;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  lastRunAt?: FirestoreTimestamp;
  runCount: number;
  errorCount: number;
}

export interface AutomationScope {
  type: 'org' | 'workspace' | 'space' | 'list';
  id: string;
}

export interface AutomationTrigger {
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface AutomationCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: unknown;
  logic: 'and' | 'or';
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  config: Record<string, unknown>;
  order: number;
}

export interface AutomationLog extends BaseEntity {
  automationId: string;
  status: 'success' | 'failure' | 'skipped' | 'retry';
  triggerData: Record<string, unknown>;
  actionsExecuted: ActionLogEntry[];
  error?: string;
  duration: number;
}

export interface ActionLogEntry {
  actionType: ActionType;
  status: 'success' | 'failure';
  result?: unknown;
  error?: string;
}

// --- Notifications ---
export interface Notification {
  id: string;
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityRef: EntityRef;
  read: boolean;
  actorId?: string;
  createdAt: FirestoreTimestamp;
}

export type NotificationType =
  | 'task_assigned' | 'task_mentioned' | 'task_due_soon'
  | 'task_completed' | 'task_comment' | 'doc_mentioned'
  | 'channel_mention' | 'automation_result' | 'system';

export interface EntityRef {
  type: ResourceType;
  id: string;
  name?: string;
}

// --- Audit Log ---
export interface AuditLog extends BaseEntity {
  orgId: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resource: ResourceType;
  resourceId: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  diff?: { field: string; old: unknown; new: unknown }[];
  ipAddress?: string;
  userAgent?: string;
}

// --- Insights (AI) ---
export interface Insight extends BaseEntity {
  orgId: string;
  type: 'summary' | 'performance' | 'forecast' | 'recommendation' | 'risk';
  scope: EntityRef;
  period?: { start: FirestoreTimestamp; end: FirestoreTimestamp };
  title: string;
  content: string;
  metrics?: Record<string, number>;
  confidence?: number;
  actionItems?: string[];
  expiresAt?: FirestoreTimestamp;
}

// --- CRM ---
export interface Contact extends BaseEntity {
  orgId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  type: 'lead' | 'client' | 'partner' | 'other';
  status: string;
  tags: string[];
  assignedTo?: string;
  customFields: Record<string, unknown>;
  notes?: string;
}

export interface Deal extends BaseEntity {
  orgId: string;
  contactId: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  expectedCloseDate?: FirestoreTimestamp;
  assignedTo: string;
  tags: string[];
  notes?: string;
}

export interface CaseRecord extends BaseEntity {
  orgId: string;
  contactId: string;
  title: string;
  caseNumber: string;
  type: string;
  status: string;
  priority: string;
  assignedTo: string;
  courtDate?: FirestoreTimestamp;
  deadlines: CaseDeadline[];
  notes?: string;
}

export interface CaseDeadline {
  id: string;
  title: string;
  date: FirestoreTimestamp;
  type: 'filing' | 'hearing' | 'response' | 'other';
  completed: boolean;
}

// --- Webhooks ---
export interface WebhookEvent extends BaseEntity {
  orgId: string;
  provider: 'whatsapp' | 'instagram' | 'messenger' | 'tiktok' | 'custom';
  eventType: string;
  payload: Record<string, unknown>;
  status: 'received' | 'processed' | 'failed' | 'ignored';
  processedAt?: FirestoreTimestamp;
  error?: string;
  retryCount: number;
}

// --- Templates ---
export interface Template extends BaseEntity {
  orgId: string;
  name: string;
  description?: string;
  type: 'task' | 'list' | 'space' | 'doc' | 'email' | 'automation';
  content: Record<string, unknown>;
  variables: TemplateVariable[];
  isDefault: boolean;
  category?: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'date' | 'user' | 'select';
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

// --- Email Templates ---
export interface EmailTemplate extends BaseEntity {
  orgId: string;
  name: string;
  event: string;
  subject: string;
  body: string;
  fromName?: string;
  signature?: string;
  disclaimer?: string;
  active: boolean;
}
