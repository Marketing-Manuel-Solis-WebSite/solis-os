// ================================================================
// Workspace Templates — Pre-built org setup for quick onboarding
// ================================================================
// Provides template definitions for complete workspace configurations
// including teams, spaces, lists, automations, and sample goals.

// ---- Types ----

export type WorkspaceTemplateCategory =
  | 'law_firm'
  | 'marketing_agency'
  | 'software_dev'
  | 'consulting'
  | 'general'
  | 'startup'
  | 'custom';

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkspaceTemplateCategory;
  icon: string;
  teams: TeamTemplate[];
  spaces: SpaceTemplate[];
  automations: AutomationTemplate[];
  goals: GoalTemplate[];
  customStatuses: string[];
  tags: string[];
}

export interface TeamTemplate {
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface SpaceTemplate {
  name: string;
  teamRef: string;  // references TeamTemplate.name
  lists: ListTemplate[];
  folders: FolderTemplate[];
}

export interface ListTemplate {
  name: string;
  folderRef?: string; // references FolderTemplate.name
}

export interface FolderTemplate {
  name: string;
}

export interface AutomationTemplate {
  name: string;
  trigger: string;
  conditions: string;
  actions: string;
}

export interface GoalTemplate {
  name: string;
  description: string;
  targetType: string;
  targetValue: number;
}

// ---- Built-in Templates ----

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'law_firm_immigration',
    name: 'Immigration Law Firm',
    description: 'Complete setup for immigration law practice with case management, client intake, and compliance tracking.',
    category: 'law_firm',
    icon: 'Scale',
    teams: [
      { name: 'Intake', icon: '📞', color: '#3B82F6', description: 'Lead intake and initial consultations' },
      { name: 'Case Management', icon: '📋', color: '#22C55E', description: 'Active case processing' },
      { name: 'Compliance', icon: '🛡️', color: '#F59E0B', description: 'Regulatory compliance and deadlines' },
      { name: 'Administration', icon: '⚙️', color: '#6B7280', description: 'Office management and operations' },
    ],
    spaces: [
      {
        name: 'Client Cases',
        teamRef: 'Case Management',
        folders: [{ name: 'Active Cases' }, { name: 'Pending Review' }, { name: 'Closed Cases' }],
        lists: [
          { name: 'New Applications', folderRef: 'Active Cases' },
          { name: 'Document Collection', folderRef: 'Active Cases' },
          { name: 'Awaiting Decision', folderRef: 'Pending Review' },
          { name: 'Approved Cases', folderRef: 'Closed Cases' },
        ],
      },
      {
        name: 'Lead Pipeline',
        teamRef: 'Intake',
        folders: [{ name: 'Funnel Stages' }],
        lists: [
          { name: 'New Leads' },
          { name: 'Consultation Scheduled' },
          { name: 'Follow-up Required' },
        ],
      },
    ],
    automations: [
      { name: 'Deadline Alert', trigger: 'task.due_date_changed', conditions: 'dueDate is within 3 days', actions: 'notify assignee + manager' },
      { name: 'New Case Assignment', trigger: 'task.created', conditions: 'tag contains "new-case"', actions: 'assign to Case Management lead' },
      { name: 'Overdue Escalation', trigger: 'task.overdue', conditions: 'priority is high or urgent', actions: 'notify admin + change priority to urgent' },
    ],
    goals: [
      { name: 'Monthly Case Closings', description: 'Close 20 cases per month', targetType: 'number', targetValue: 20 },
      { name: 'Client Satisfaction', description: 'Maintain 90%+ client satisfaction', targetType: 'percentage', targetValue: 90 },
    ],
    customStatuses: ['intake', 'document_review', 'filed', 'awaiting_decision', 'approved', 'denied', 'appeal'],
    tags: ['immigration', 'visa', 'asylum', 'green-card', 'citizenship', 'deportation-defense', 'family-petition', 'work-permit'],
  },
  {
    id: 'software_startup',
    name: 'Software Startup',
    description: 'Agile development workspace with sprints, bug tracking, and product roadmap.',
    category: 'software_dev',
    icon: 'Code',
    teams: [
      { name: 'Engineering', icon: '💻', color: '#8B5CF6', description: 'Software development team' },
      { name: 'Product', icon: '🎯', color: '#3B82F6', description: 'Product management' },
      { name: 'Design', icon: '🎨', color: '#EC4899', description: 'UI/UX design' },
      { name: 'Operations', icon: '⚙️', color: '#6B7280', description: 'DevOps and infrastructure' },
    ],
    spaces: [
      {
        name: 'Product Development',
        teamRef: 'Engineering',
        folders: [{ name: 'Current Sprint' }, { name: 'Backlog' }, { name: 'Done' }],
        lists: [
          { name: 'Sprint Tasks', folderRef: 'Current Sprint' },
          { name: 'Bug Reports', folderRef: 'Current Sprint' },
          { name: 'Feature Requests', folderRef: 'Backlog' },
          { name: 'Tech Debt', folderRef: 'Backlog' },
        ],
      },
      {
        name: 'Product Roadmap',
        teamRef: 'Product',
        folders: [],
        lists: [
          { name: 'Q1 Initiatives' },
          { name: 'Q2 Initiatives' },
          { name: 'Ideas & Research' },
        ],
      },
    ],
    automations: [
      { name: 'Bug Triage', trigger: 'task.created', conditions: 'tag contains "bug"', actions: 'set priority to high, notify engineering lead' },
      { name: 'Sprint Complete', trigger: 'task.status_changed', conditions: 'status is done AND tag contains "sprint"', actions: 'notify product manager' },
    ],
    goals: [
      { name: 'Sprint Velocity', description: 'Complete 40 story points per sprint', targetType: 'number', targetValue: 40 },
      { name: 'Bug Resolution Time', description: 'Average bug fix time under 48 hours', targetType: 'number', targetValue: 48 },
    ],
    customStatuses: ['backlog', 'ready', 'in_progress', 'in_review', 'testing', 'done'],
    tags: ['bug', 'feature', 'tech-debt', 'design', 'infrastructure', 'security', 'performance', 'documentation'],
  },
  {
    id: 'marketing_agency',
    name: 'Marketing Agency',
    description: 'Campaign management, content calendar, and client deliverables tracking.',
    category: 'marketing_agency',
    icon: 'Megaphone',
    teams: [
      { name: 'Creative', icon: '🎨', color: '#EC4899', description: 'Content creation and design' },
      { name: 'Strategy', icon: '📊', color: '#3B82F6', description: 'Campaign strategy and analytics' },
      { name: 'Account Management', icon: '🤝', color: '#22C55E', description: 'Client relationships' },
    ],
    spaces: [
      {
        name: 'Campaigns',
        teamRef: 'Strategy',
        folders: [{ name: 'Active Campaigns' }, { name: 'Completed' }],
        lists: [
          { name: 'Campaign Planning', folderRef: 'Active Campaigns' },
          { name: 'Content Calendar', folderRef: 'Active Campaigns' },
          { name: 'Performance Review', folderRef: 'Completed' },
        ],
      },
    ],
    automations: [
      { name: 'Content Deadline', trigger: 'task.due_date_changed', conditions: 'tag contains "content"', actions: 'notify creative team' },
      { name: 'Campaign Launch', trigger: 'task.status_changed', conditions: 'status is "launched"', actions: 'notify account manager + create report task' },
    ],
    goals: [
      { name: 'Monthly Content Output', description: 'Publish 30 pieces of content per month', targetType: 'number', targetValue: 30 },
      { name: 'Campaign ROI', description: 'Achieve 3x return on ad spend', targetType: 'number', targetValue: 300 },
    ],
    customStatuses: ['ideation', 'draft', 'review', 'approved', 'scheduled', 'published', 'analyzing'],
    tags: ['social-media', 'blog', 'email', 'paid-ads', 'seo', 'video', 'branding', 'analytics'],
  },
  {
    id: 'general_workspace',
    name: 'General Workspace',
    description: 'Flexible workspace template suitable for any team or organization.',
    category: 'general',
    icon: 'Briefcase',
    teams: [
      { name: 'Team A', icon: '🔵', color: '#3B82F6', description: 'Primary team' },
      { name: 'Team B', icon: '🟢', color: '#22C55E', description: 'Secondary team' },
    ],
    spaces: [
      {
        name: 'Projects',
        teamRef: 'Team A',
        folders: [{ name: 'Active' }, { name: 'Archive' }],
        lists: [
          { name: 'Current Tasks', folderRef: 'Active' },
          { name: 'Backlog', folderRef: 'Active' },
        ],
      },
    ],
    automations: [
      { name: 'Overdue Alert', trigger: 'task.overdue', conditions: 'any', actions: 'notify assignee' },
    ],
    goals: [
      { name: 'Weekly Task Completion', description: 'Complete 90% of planned tasks each week', targetType: 'percentage', targetValue: 90 },
    ],
    customStatuses: ['todo', 'in_progress', 'in_review', 'done'],
    tags: ['urgent', 'blocked', 'meeting', 'research', 'follow-up'],
  },
];

// ---- Lookup & Filter ----

export function getTemplateById(id: string): WorkspaceTemplate | undefined {
  return WORKSPACE_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: WorkspaceTemplateCategory): WorkspaceTemplate[] {
  return WORKSPACE_TEMPLATES.filter(t => t.category === category);
}

export function getAllTemplateCategories(): { value: WorkspaceTemplateCategory; label: string }[] {
  return [
    { value: 'law_firm', label: 'Law Firm' },
    { value: 'marketing_agency', label: 'Marketing Agency' },
    { value: 'software_dev', label: 'Software Development' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'startup', label: 'Startup' },
    { value: 'general', label: 'General' },
  ];
}
