import type { LucideIcon } from 'lucide-react';

// ============================================
// PROVIDERS & CATEGORIES
// ============================================
export type IntegrationProvider =
  | 'slack' | 'discord' | 'teams'
  | 'github' | 'gitlab' | 'bitbucket' | 'jira'
  | 'google_calendar' | 'outlook_calendar'
  | 'google_drive' | 'dropbox' | 'onedrive'
  | 'hubspot' | 'salesforce' | 'zendesk' | 'intercom'
  | 'zapier' | 'make' | 'stripe' | 'typeform'
  | 'figma' | 'notion' | 'airtable'
  | 'custom_webhook';

export type IntegrationCategory =
  | 'communication' | 'calendar' | 'storage'
  | 'dev' | 'crm' | 'automation' | 'design' | 'payments' | 'generic';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

// ============================================
// API KEYS
// ============================================
export type ApiKeyScope =
  | 'tasks:read' | 'tasks:write'
  | 'goals:read' | 'goals:write'
  | 'timeentries:read' | 'timeentries:write'
  | 'forms:read' | 'members:read';

export const ALL_SCOPES: { value: ApiKeyScope; labelKey: string; group: string }[] = [
  { value: 'tasks:read', labelKey: 'integ.scopes.tasksRead', group: 'Tasks' },
  { value: 'tasks:write', labelKey: 'integ.scopes.tasksWrite', group: 'Tasks' },
  { value: 'goals:read', labelKey: 'integ.scopes.goalsRead', group: 'Goals' },
  { value: 'goals:write', labelKey: 'integ.scopes.goalsWrite', group: 'Goals' },
  { value: 'timeentries:read', labelKey: 'integ.scopes.timeentriesRead', group: 'Time' },
  { value: 'timeentries:write', labelKey: 'integ.scopes.timeentriesWrite', group: 'Time' },
  { value: 'forms:read', labelKey: 'integ.scopes.formsRead', group: 'Forms' },
  { value: 'members:read', labelKey: 'integ.scopes.membersRead', group: 'Members' },
];

// ============================================
// WEBHOOK EVENTS
// ============================================
export type WebhookEvent =
  | 'task.created' | 'task.updated' | 'task.deleted' | 'task.status_changed'
  | 'goal.created' | 'goal.updated' | 'goal.progress_changed'
  | 'form.submitted'
  | 'member.added' | 'member.updated';

export const ALL_EVENTS: { value: WebhookEvent; labelKey: string; group: string }[] = [
  { value: 'task.created', labelKey: 'integ.events.taskCreated', group: 'Tasks' },
  { value: 'task.updated', labelKey: 'integ.events.taskUpdated', group: 'Tasks' },
  { value: 'task.deleted', labelKey: 'integ.events.taskDeleted', group: 'Tasks' },
  { value: 'task.status_changed', labelKey: 'integ.events.taskStatusChanged', group: 'Tasks' },
  { value: 'goal.created', labelKey: 'integ.events.goalCreated', group: 'Goals' },
  { value: 'goal.updated', labelKey: 'integ.events.goalUpdated', group: 'Goals' },
  { value: 'goal.progress_changed', labelKey: 'integ.events.goalProgressChanged', group: 'Goals' },
  { value: 'form.submitted', labelKey: 'integ.events.formSubmitted', group: 'Forms' },
  { value: 'member.added', labelKey: 'integ.events.memberAdded', group: 'Members' },
  { value: 'member.updated', labelKey: 'integ.events.memberUpdated', group: 'Members' },
];

// ============================================
// RECORDS (Firestore documents)
// ============================================
export interface IntegrationDef {
  provider: IntegrationProvider;
  name: string;
  descriptionKey: string;
  category: IntegrationCategory;
  icon: LucideIcon;
  color: string;
  oauthSupported: boolean;
  webhookSupported: boolean;
  apiKeySupported: boolean;
  comingSoon?: boolean;
}

export interface IntegrationRecord {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  status: IntegrationStatus;
  displayName: string;
  config: Record<string, any>;
  oauthTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string;
  };
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface ApiKeyRecord {
  id: string;
  orgId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdBy: string;
  lastUsedAt: any;
  expiresAt: any;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface WebhookRecord {
  id: string;
  orgId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdBy: string;
  deliveryStats: {
    total: number;
    success: number;
    failed: number;
    lastDeliveredAt: any;
  };
  createdAt: any;
  updatedAt: any;
}

export interface WebhookLogRecord {
  id: string;
  event: string;
  payload: any;
  status: 'success' | 'failed' | 'pending';
  statusCode: number | null;
  responseBody: string;
  attemptCount: number;
  nextRetryAt: any;
  deliveredAt: any;
  createdAt: any;
}

export interface IncomingWebhookRecord {
  id: string;
  orgId: string;
  name: string;
  provider: string;
  token: string;
  secret: string;
  actionType: 'create_task' | 'create_notification' | 'trigger_automation';
  actionConfig: Record<string, any>;
  active: boolean;
  eventCount: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface WebhookEventRecord {
  id: string;
  orgId: string;
  eventType: WebhookEvent;
  entityId: string;
  entityType: string;
  payload: any;
  processed: boolean;
  processedAt: any;
  createdAt: any;
}
