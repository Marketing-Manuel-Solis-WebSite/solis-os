// @vitest-environment jsdom
// ================================================================
// Smoke test: WidgetGrid — renders empty state, renders widget cards
// ================================================================
import React from 'react';
import { describe, test, expect, vi, beforeAll } from 'vitest';
import { render, screen } from './test-utils';

// jsdom does not ship ResizeObserver — provide a stub
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

// ---- Mock dnd-kit ----
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  rectSortingStrategy: {},
  arrayMove: (arr: any[]) => arr,
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

// ---- Mock all widget sub-components ----
vi.mock('@/components/dashboard/widgets/stat-card', () => ({
  StatCardWidget: (props: any) => <div data-testid="widget-stat-card">stat-card</div>,
}));
vi.mock('@/components/dashboard/widgets/tasks-by-status', () => ({
  TasksByStatusWidget: (props: any) => <div data-testid="widget-tasks-by-status">tasks-by-status</div>,
}));
vi.mock('@/components/dashboard/widgets/my-tasks', () => ({
  MyTasksWidget: (props: any) => <div data-testid="widget-my-tasks">my-tasks</div>,
}));
vi.mock('@/components/dashboard/widgets/activity-feed', () => ({
  ActivityFeedWidget: (props: any) => <div data-testid="widget-activity-feed">activity-feed</div>,
}));
vi.mock('@/components/dashboard/widgets/goals-progress', () => ({
  GoalsProgressWidget: (props: any) => <div data-testid="widget-goals-progress">goals-progress</div>,
}));
vi.mock('@/components/dashboard/widgets/completion-trend', () => ({
  CompletionTrendWidget: (props: any) => <div data-testid="widget-completion-trend">completion-trend</div>,
}));
vi.mock('@/components/dashboard/widgets/upcoming-deadlines', () => ({
  UpcomingDeadlinesWidget: (props: any) => <div data-testid="widget-upcoming-deadlines">upcoming-deadlines</div>,
}));
vi.mock('@/components/dashboard/widgets/priority-breakdown', () => ({
  PriorityBreakdownWidget: (props: any) => <div data-testid="widget-priority-breakdown">priority-breakdown</div>,
}));
vi.mock('@/components/dashboard/widgets/team-performance', () => ({
  TeamPerformanceWidget: (props: any) => <div data-testid="widget-team-performance">team-performance</div>,
}));
vi.mock('@/components/dashboard/widgets/inbox-widget', () => ({
  InboxWidget: (props: any) => <div data-testid="widget-inbox">inbox</div>,
}));
vi.mock('@/components/dashboard/widgets/ai-insights', () => ({
  AIInsightsWidget: (props: any) => <div data-testid="widget-ai-insights">ai-insights</div>,
}));
vi.mock('@/components/dashboard/widgets/burndown-chart', () => ({
  BurndownChartWidget: (props: any) => <div data-testid="widget-burndown-chart">burndown-chart</div>,
}));
vi.mock('@/components/dashboard/widgets/portfolio-summary', () => ({
  PortfolioSummaryWidget: (props: any) => <div data-testid="widget-portfolio-summary">portfolio-summary</div>,
}));
vi.mock('@/components/dashboard/widgets/workload-heatmap', () => ({
  WorkloadHeatmapWidget: (props: any) => <div data-testid="widget-workload-heatmap">workload-heatmap</div>,
}));
vi.mock('@/components/dashboard/widgets/time-tracking-summary', () => ({
  TimeTrackingSummaryWidget: (props: any) => <div data-testid="widget-time-tracking-summary">time-tracking-summary</div>,
}));
vi.mock('@/components/dashboard/widgets/department-metrics', () => ({
  DepartmentMetricsWidget: (props: any) => <div data-testid="widget-department-metrics">department-metrics</div>,
}));

// ---- Import component under test ----
import WidgetGrid from '@/components/dashboard/widget-grid';

describe('WidgetGrid — smoke tests', () => {
  const sharedProps = {
    tasks: [],
    goals: [],
    members: [],
    userId: 'test-user-1',
    orgId: 'solis-center',
    isAdmin: false,
    dateRange: '30d' as const,
    user: null,
    teams: [],
    logs: [],
    me: null,
    timeEntries: [],
    submissions: [],
  } as any;

  test('renders empty state with no widgets', () => {
    render(<WidgetGrid widgets={[]} sharedProps={sharedProps} />);
    expect(screen.getByText('No hay widgets')).toBeInTheDocument();
  });

  test('renders widget cards', () => {
    const widgets = [
      { widgetId: 'w1', type: 'stat-card', x: 0, y: 0, w: 1, h: 1, config: {} },
      { widgetId: 'w2', type: 'my-tasks', x: 1, y: 0, w: 2, h: 1, config: {} },
    ] as any[];

    render(<WidgetGrid widgets={widgets} sharedProps={sharedProps} />);
    expect(screen.getByTestId('widget-stat-card')).toBeInTheDocument();
    expect(screen.getByTestId('widget-my-tasks')).toBeInTheDocument();
  });
});
