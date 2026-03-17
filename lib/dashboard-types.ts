// ================================================================
// DASHBOARD 2.0 — Type Definitions
// ================================================================

export interface WidgetLayout {
  widgetId: string;
  type: WidgetType;
  x: number;       // grid column (0-based)
  y: number;       // grid row (0-based)
  w: number;       // width in grid units
  h: number;       // height in grid units
  config: WidgetConfig;
}

export interface WidgetConfig {
  title?: string;
  teamId?: string;       // filter by team, '__all__' = all
  dateRange?: DateRange;
  limit?: number;
  metric?: string;       // for stat-card: which KPI
  chartType?: 'bar' | 'donut' | 'line' | 'area';
  showTrend?: boolean;
  [key: string]: any;
}

export type DateRange = '7d' | '30d' | '90d' | 'all';

export type WidgetType =
  | 'stat-card'
  | 'tasks-by-status'
  | 'my-tasks'
  | 'activity-feed'
  | 'goals-progress'
  | 'completion-trend'
  | 'priority-breakdown'
  | 'team-performance'
  | 'upcoming-deadlines'
  | 'inbox'
  | 'ai-insights'
  | 'workload-heatmap'
  | 'time-tracking-summary'
  | 'department-metrics'
  | 'burndown-chart'
  | 'portfolio-summary';

export type DashboardScopeType = 'space' | 'folder' | 'list' | 'global';
export type DashboardVisibility = 'private' | 'shared';

export interface DashboardConfig {
  id: string;
  userId: string;
  title: string;
  isDefault: boolean;
  widgets: WidgetLayout[];
  spaceId?: string;       // If set, this dashboard belongs to a specific space
  folderId?: string;      // If set, this dashboard belongs to a specific folder
  listId?: string;        // If set, this dashboard belongs to a specific list
  scopeType?: DashboardScopeType; // Contextual scope type
  visibility?: DashboardVisibility; // Private or shared dashboard
  isShared?: boolean;      // Whether the dashboard is publicly shared
  publicToken?: string;    // UUID token for public access
  shareMode?: 'view' | 'interact'; // view = static snapshot, interact = live filters
  createdAt?: any;
  updatedAt?: any;
}

export interface WidgetTypeDefinition {
  type: WidgetType;
  nameKey: string;        // i18n key for display name
  descriptionKey: string; // i18n key for description
  icon: string;           // lucide icon name
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
}

// Widget component props — every widget receives these
export interface WidgetProps {
  config: WidgetConfig;
  tasks: any[];
  goals: any[];
  logs: any[];
  teams: any[];
  members: any[];
  user: any;
  me: any;
  canSeeAllTeams: boolean;
  activeTeamId: string;
  onDrillDown?: (type: string, data: any) => void;
}

// Widgets that require admin/director privileges to view
// Enforced at: widget picker, widget grid runtime, default layouts
export const ADMIN_ONLY_TYPES: Set<WidgetType> = new Set([
  'team-performance',
  'activity-feed',
]);

// Default dashboard for regular members — personal scope only
export const DEFAULT_WIDGETS: WidgetLayout[] = [
  { widgetId: 'w1', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'totalTasks' } },
  { widgetId: 'w2', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'inProgress' } },
  { widgetId: 'w3', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'completed' } },
  { widgetId: 'w4', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'overdue' } },
  { widgetId: 'w5', type: 'my-tasks', x: 0, y: 0, w: 2, h: 2, config: { limit: 8 } },
  { widgetId: 'w6', type: 'upcoming-deadlines', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w7', type: 'inbox', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w8', type: 'goals-progress', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w9', type: 'tasks-by-status', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w10', type: 'completion-trend', x: 0, y: 0, w: 2, h: 2, config: { dateRange: '30d' } },
];

// Admin/Director dashboard — includes team performance + inbox + AI insights
export const ADMIN_DEFAULT_WIDGETS: WidgetLayout[] = [
  { widgetId: 'w1', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'totalTasks' } },
  { widgetId: 'w2', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'inProgress' } },
  { widgetId: 'w3', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'completed' } },
  { widgetId: 'w4', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'overdue' } },
  { widgetId: 'w5', type: 'team-performance', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w6', type: 'ai-insights', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w7', type: 'my-tasks', x: 0, y: 0, w: 2, h: 2, config: { limit: 8 } },
  { widgetId: 'w8', type: 'inbox', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w9', type: 'completion-trend', x: 0, y: 0, w: 2, h: 2, config: { dateRange: '30d' } },
  { widgetId: 'w10', type: 'tasks-by-status', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w11', type: 'priority-breakdown', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w12', type: 'upcoming-deadlines', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w13', type: 'goals-progress', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'w14', type: 'activity-feed', x: 0, y: 0, w: 2, h: 2, config: { limit: 10 } },
];

// Default dashboard for spaces — focused on team metrics
export const SPACE_DEFAULT_WIDGETS: WidgetLayout[] = [
  { widgetId: 'sw1', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'totalTasks' } },
  { widgetId: 'sw2', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'inProgress' } },
  { widgetId: 'sw3', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'completed' } },
  { widgetId: 'sw4', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'overdue' } },
  { widgetId: 'sw5', type: 'tasks-by-status', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'sw6', type: 'completion-trend', x: 0, y: 0, w: 2, h: 2, config: { dateRange: '30d' } },
  { widgetId: 'sw7', type: 'priority-breakdown', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'sw8', type: 'goals-progress', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'sw9', type: 'upcoming-deadlines', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'sw10', type: 'my-tasks', x: 0, y: 0, w: 2, h: 2, config: { limit: 8 } },
];

// Overview dashboard for folders — high-level overview with activity
export const OVERVIEW_DEFAULT_WIDGETS: WidgetLayout[] = [
  { widgetId: 'ow1', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'totalTasks' } },
  { widgetId: 'ow2', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'inProgress' } },
  { widgetId: 'ow3', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'completed' } },
  { widgetId: 'ow4', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'overdue' } },
  { widgetId: 'ow5', type: 'activity-feed', x: 0, y: 0, w: 2, h: 2, config: { limit: 10 } },
  { widgetId: 'ow6', type: 'goals-progress', x: 0, y: 0, w: 2, h: 2, config: {} },
];

// List-level dashboard — focused on task execution & deadlines
export const LIST_DEFAULT_WIDGETS: WidgetLayout[] = [
  { widgetId: 'lw1', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'totalTasks' } },
  { widgetId: 'lw2', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'inProgress' } },
  { widgetId: 'lw3', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'completed' } },
  { widgetId: 'lw4', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: { metric: 'overdue' } },
  { widgetId: 'lw5', type: 'tasks-by-status', x: 0, y: 0, w: 2, h: 2, config: {} },
  { widgetId: 'lw6', type: 'upcoming-deadlines', x: 0, y: 0, w: 2, h: 2, config: {} },
];

// Widget type catalog
export const WIDGET_CATALOG: WidgetTypeDefinition[] = [
  { type: 'stat-card', nameKey: 'dashboard.widget.statCard', descriptionKey: 'dashboard.widget.statCardDesc', icon: 'Hash', defaultSize: { w: 1, h: 1 }, minSize: { w: 1, h: 1 }, maxSize: { w: 2, h: 1 } },
  { type: 'tasks-by-status', nameKey: 'dashboard.widget.tasksByStatus', descriptionKey: 'dashboard.widget.tasksByStatusDesc', icon: 'PieChart', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'my-tasks', nameKey: 'dashboard.widget.myTasks', descriptionKey: 'dashboard.widget.myTasksDesc', icon: 'CheckSquare', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 4 } },
  { type: 'activity-feed', nameKey: 'dashboard.widget.activityFeed', descriptionKey: 'dashboard.widget.activityFeedDesc', icon: 'Activity', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 4 } },
  { type: 'goals-progress', nameKey: 'dashboard.widget.goalsProgress', descriptionKey: 'dashboard.widget.goalsProgressDesc', icon: 'Target', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'completion-trend', nameKey: 'dashboard.widget.completionTrend', descriptionKey: 'dashboard.widget.completionTrendDesc', icon: 'TrendingUp', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'upcoming-deadlines', nameKey: 'dashboard.widget.upcomingDeadlines', descriptionKey: 'dashboard.widget.upcomingDeadlinesDesc', icon: 'Calendar', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'priority-breakdown', nameKey: 'dashboard.widget.priorityBreakdown', descriptionKey: 'dashboard.widget.priorityBreakdownDesc', icon: 'Flag', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'team-performance', nameKey: 'dashboard.widget.teamPerformance', descriptionKey: 'dashboard.widget.teamPerformanceDesc', icon: 'BarChart3', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'inbox', nameKey: 'dashboard.widget.inbox', descriptionKey: 'dashboard.widget.inboxDesc', icon: 'Inbox', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 4 } },
  { type: 'ai-insights', nameKey: 'dashboard.widget.aiInsights', descriptionKey: 'dashboard.widget.aiInsightsDesc', icon: 'Sparkles', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'burndown-chart', nameKey: 'dashboard.widget.burndownChart', descriptionKey: 'dashboard.widget.burndownChartDesc', icon: 'TrendingDown', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'portfolio-summary', nameKey: 'dashboard.widget.portfolioSummary', descriptionKey: 'dashboard.widget.portfolioSummaryDesc', icon: 'Briefcase', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 4 } },
  { type: 'workload-heatmap', nameKey: 'dashboard.widget.workloadHeatmap', descriptionKey: 'dashboard.widget.workloadHeatmapDesc', icon: 'Flame', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'time-tracking-summary', nameKey: 'dashboard.widget.timeTrackingSummary', descriptionKey: 'dashboard.widget.timeTrackingSummaryDesc', icon: 'Clock', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  { type: 'department-metrics', nameKey: 'dashboard.widget.departmentMetrics', descriptionKey: 'dashboard.widget.departmentMetricsDesc', icon: 'Building2', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
];
