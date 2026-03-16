// ============================================================
// Built-in View Registration — side-effect import
// ============================================================
// Import this module to register the 3 built-in views (list, board, calendar)
// in the view registry. Each existing component accepts a subset of ViewProps;
// React gracefully ignores extra props on function components.

import type { ComponentType } from 'react';
import { registerView, type ViewProps } from './view-registry';
import TaskListView from '@/components/tasks/task-list-view';
import TaskBoardView from '@/components/tasks/task-board-view';
import TaskCalendarView from '@/components/tasks/task-calendar-view';
import TaskTableView from '@/components/tasks/task-table-view';
import TaskGanttView from '@/components/tasks/task-gantt-view';
import TaskTimelineView from '@/components/tasks/task-timeline-view';
import TaskWorkloadView from '@/components/tasks/task-workload-view';
import TaskTeamView from '@/components/tasks/task-team-view';
import TaskActivityView from '@/components/tasks/task-activity-view';

// Cast: each view component uses a subset of ViewProps — safe at runtime.
registerView({
  id: 'list',
  name: 'List',
  nameEs: 'Lista',
  iconName: 'LayoutList',
  shortcut: '1',
  component: TaskListView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: true,
    sort: true,
    filter: true,
    density: true,
    columns: true,
    bulkSelect: true,
    calendarMode: false,
  },
});

registerView({
  id: 'board',
  name: 'Board',
  nameEs: 'Tablero',
  iconName: 'LayoutGrid',
  shortcut: '2',
  component: TaskBoardView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: true,
    sort: false,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: false,
  },
});

registerView({
  id: 'calendar',
  name: 'Calendar',
  nameEs: 'Calendario',
  iconName: 'Calendar',
  shortcut: '3',
  component: TaskCalendarView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: false,
    sort: false,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: true,
  },
});

registerView({
  id: 'table',
  name: 'Table',
  nameEs: 'Tabla',
  iconName: 'Table2',
  shortcut: '4',
  component: TaskTableView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: true,
    sort: true,
    filter: true,
    density: false,
    columns: false, // table shows all columns by default
    bulkSelect: false,
    calendarMode: false,
  },
});

registerView({
  id: 'gantt',
  name: 'Gantt',
  nameEs: 'Gantt',
  iconName: 'GanttChart',
  shortcut: '5',
  component: TaskGanttView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: false,
    sort: false,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: false,
  },
});

registerView({
  id: 'timeline',
  name: 'Timeline',
  nameEs: 'Cronograma',
  iconName: 'Clock',
  shortcut: '6',
  component: TaskTimelineView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: false,
    sort: false,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: false,
  },
});

registerView({
  id: 'workload',
  name: 'Workload',
  nameEs: 'Carga',
  iconName: 'BarChart3',
  shortcut: '7',
  component: TaskWorkloadView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: false,
    sort: false,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: false,
  },
});

registerView({
  id: 'team',
  name: 'Team',
  nameEs: 'Equipo',
  iconName: 'Users',
  shortcut: '8',
  component: TaskTeamView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: false,
    sort: false,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: false,
  },
});

registerView({
  id: 'activity',
  name: 'Activity',
  nameEs: 'Actividad',
  iconName: 'Activity',
  component: TaskActivityView as unknown as ComponentType<ViewProps>,
  capabilities: {
    groupBy: false,
    sort: false,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: false,
  },
});
