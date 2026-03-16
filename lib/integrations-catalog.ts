import {
  MessageSquare, Hash, Users2,
  Github, GitBranch, Kanban,
  Calendar, CalendarDays,
  HardDrive, Cloud, Database,
  Building2, Headphones, UserPlus,
  Zap, Workflow, CreditCard, FileSpreadsheet,
  Figma, BookOpen, LayoutGrid, Webhook,
} from 'lucide-react';
import type { IntegrationDef, IntegrationCategory } from './integrations-types';

export const INTEGRATION_CATALOG: IntegrationDef[] = [
  // ─── Communication ──────────────────────────
  // depth: full = OAuth + send messages + list channels + rich blocks
  { provider: 'slack', name: 'Slack', descriptionKey: 'integ.provider.slackDesc', category: 'communication', icon: MessageSquare, color: '#4A154B', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'full' },
  { provider: 'discord', name: 'Discord', descriptionKey: 'integ.provider.discordDesc', category: 'communication', icon: Hash, color: '#5865F2', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic', comingSoon: true },
  { provider: 'teams', name: 'Microsoft Teams', descriptionKey: 'integ.provider.teamsDesc', category: 'communication', icon: Users2, color: '#6264A7', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic', comingSoon: true },

  // ─── Development ────────────────────────────
  // depth: full = OAuth + CRUD issues + comments + labels + webhook receiver
  { provider: 'github', name: 'GitHub', descriptionKey: 'integ.provider.githubDesc', category: 'dev', icon: Github, color: '#24292F', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'full' },
  { provider: 'gitlab', name: 'GitLab', descriptionKey: 'integ.provider.gitlabDesc', category: 'dev', icon: GitBranch, color: '#FC6D26', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic' },
  // depth: full = OAuth + CRUD issues + transitions + comments + webhook receiver
  { provider: 'jira', name: 'Jira', descriptionKey: 'integ.provider.jiraDesc', category: 'dev', icon: Kanban, color: '#0052CC', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'full' },

  // ─── Calendar ───────────────────────────────
  // depth: full = OAuth + list/create/update/delete events + token refresh
  { provider: 'google_calendar', name: 'Google Calendar', descriptionKey: 'integ.provider.gcalDesc', category: 'calendar', icon: Calendar, color: '#4285F4', oauthSupported: true, webhookSupported: false, apiKeySupported: false, depth: 'full' },
  { provider: 'outlook_calendar', name: 'Outlook Calendar', descriptionKey: 'integ.provider.outlookDesc', category: 'calendar', icon: CalendarDays, color: '#0078D4', oauthSupported: true, webhookSupported: false, apiKeySupported: false, depth: 'read_only' },

  // ─── Storage ────────────────────────────────
  { provider: 'google_drive', name: 'Google Drive', descriptionKey: 'integ.provider.gdriveDesc', category: 'storage', icon: HardDrive, color: '#0F9D58', oauthSupported: true, webhookSupported: false, apiKeySupported: false, depth: 'read_only' },
  { provider: 'dropbox', name: 'Dropbox', descriptionKey: 'integ.provider.dropboxDesc', category: 'storage', icon: Cloud, color: '#0061FF', oauthSupported: true, webhookSupported: false, apiKeySupported: false, depth: 'read_only' },
  { provider: 'onedrive', name: 'OneDrive', descriptionKey: 'integ.provider.onedriveDesc', category: 'storage', icon: Database, color: '#0078D4', oauthSupported: true, webhookSupported: false, apiKeySupported: false, depth: 'read_only' },

  // ─── CRM ────────────────────────────────────
  { provider: 'hubspot', name: 'HubSpot', descriptionKey: 'integ.provider.hubspotDesc', category: 'crm', icon: Building2, color: '#FF7A59', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic' },
  { provider: 'zendesk', name: 'Zendesk', descriptionKey: 'integ.provider.zendeskDesc', category: 'crm', icon: Headphones, color: '#03363D', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic', comingSoon: true },
  { provider: 'intercom', name: 'Intercom', descriptionKey: 'integ.provider.intercomDesc', category: 'crm', icon: UserPlus, color: '#6AFDEF', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic' },

  // ─── Automation ─────────────────────────────
  { provider: 'zapier', name: 'Zapier', descriptionKey: 'integ.provider.zapierDesc', category: 'automation', icon: Zap, color: '#FF4A00', oauthSupported: false, webhookSupported: true, apiKeySupported: true, depth: 'basic' },
  { provider: 'make', name: 'Make (Integromat)', descriptionKey: 'integ.provider.makeDesc', category: 'automation', icon: Workflow, color: '#6D00CC', oauthSupported: false, webhookSupported: true, apiKeySupported: true, depth: 'basic' },
  { provider: 'typeform', name: 'Typeform', descriptionKey: 'integ.provider.typeformDesc', category: 'automation', icon: FileSpreadsheet, color: '#262627', oauthSupported: false, webhookSupported: true, apiKeySupported: false, depth: 'basic' },

  // ─── Payments ───────────────────────────────
  { provider: 'stripe', name: 'Stripe', descriptionKey: 'integ.provider.stripeDesc', category: 'payments', icon: CreditCard, color: '#635BFF', oauthSupported: false, webhookSupported: true, apiKeySupported: false, depth: 'basic' },

  // ─── Design / Productivity ──────────────────
  { provider: 'figma', name: 'Figma', descriptionKey: 'integ.provider.figmaDesc', category: 'design', icon: Figma, color: '#F24E1E', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic' },
  // depth: full = OAuth + search pages + list/query databases + create pages
  { provider: 'notion', name: 'Notion', descriptionKey: 'integ.provider.notionDesc', category: 'design', icon: BookOpen, color: '#000000', oauthSupported: true, webhookSupported: false, apiKeySupported: false, depth: 'full' },
  { provider: 'airtable', name: 'Airtable', descriptionKey: 'integ.provider.airtableDesc', category: 'design', icon: LayoutGrid, color: '#18BFFF', oauthSupported: true, webhookSupported: true, apiKeySupported: false, depth: 'basic' },

  // ─── Generic ────────────────────────────────
  { provider: 'custom_webhook', name: 'Custom Webhook', descriptionKey: 'integ.provider.customDesc', category: 'generic', icon: Webhook, color: '#7B68EE', oauthSupported: false, webhookSupported: true, apiKeySupported: false, depth: 'full' },
];

export const CATEGORIES: { id: IntegrationCategory | 'all'; labelKey: string; color: string }[] = [
  { id: 'all', labelKey: 'integ.catalog.filterAll', color: '#7B68EE' },
  { id: 'communication', labelKey: 'integ.category.communication', color: '#4A154B' },
  { id: 'dev', labelKey: 'integ.category.dev', color: '#24292F' },
  { id: 'calendar', labelKey: 'integ.category.calendar', color: '#4285F4' },
  { id: 'storage', labelKey: 'integ.category.storage', color: '#0F9D58' },
  { id: 'crm', labelKey: 'integ.category.crm', color: '#FF7A59' },
  { id: 'automation', labelKey: 'integ.category.automation', color: '#FF4A00' },
  { id: 'payments', labelKey: 'integ.category.payments', color: '#635BFF' },
  { id: 'design', labelKey: 'integ.category.design', color: '#F24E1E' },
  { id: 'generic', labelKey: 'integ.category.generic', color: '#7B68EE' },
];
