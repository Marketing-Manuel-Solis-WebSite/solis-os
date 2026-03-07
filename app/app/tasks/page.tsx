'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  getTasks, createTask, updateTask, softDeleteTask, logAction,
  addTaskActivity, getMembers, getSettings, saveSettings,
  getUserPreferences, saveUserPreferences,
} from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { handleTaskCompletion } from '@/lib/recurrence-trigger';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/components/notifications/toast-provider';

import TaskSidebar from '@/components/tasks/task-sidebar';
import TaskToolbar from '@/components/tasks/task-toolbar';
import TaskListView from '@/components/tasks/task-list-view';
import TaskBoardView from '@/components/tasks/task-board-view';
import TaskCalendarView from '@/components/tasks/task-calendar-view';
import TaskDetailDrawer from '@/components/tasks/task-detail-drawer';
import TaskCreateModal from '@/components/tasks/task-create-modal';
import ImportWizard from '@/components/tasks/import-wizard';
import TaskBulkActions from '@/components/tasks/task-bulk-actions';
import TaskEmptyState from '@/components/tasks/task-empty-state';

import {
  Task, ViewType, FilterState, EMPTY_FILTERS, SavedView, TaskGroup,
  STATUSES, SHORTCUTS,
  CalendarMode, Density, SubtaskDisplay,
  BUILT_IN_PRESETS, DEFAULT_PREFERENCES, TaskPreferences,
  applyFilters, sortTasks, groupTasks, isOverdue,
} from '@/components/tasks/constants';

const PREFS_KEY = 'taskPreferences';

export default function TasksPage() {
  const { user, me, activeTeamId, teams, can, canSeeResource, allMembers, canSeeAllTeams } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  // Core data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Preferences (loaded from Firestore)
  const [prefs, setPrefs] = useState<TaskPreferences>(DEFAULT_PREFERENCES);
  const prefsLoaded = useRef(false);

  // View state (initialized from prefs once loaded)
  const [view, setView] = useState<ViewType>(DEFAULT_PREFERENCES.defaultView);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState(DEFAULT_PREFERENCES.lastSortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(DEFAULT_PREFERENCES.lastSortDir);
  const [groupBy, setGroupBy] = useState(DEFAULT_PREFERENCES.lastGroupBy);
  const [density, setDensity] = useState<Density>(DEFAULT_PREFERENCES.density);
  const [columns, setColumns] = useState<string[]>(DEFAULT_PREFERENCES.columns);
  const [subtaskDisplay, setSubtaskDisplay] = useState<SubtaskDisplay>(DEFAULT_PREFERENCES.subtaskDisplay);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(DEFAULT_PREFERENCES.calendarMode);
  const [meMode, setMeMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(DEFAULT_PREFERENCES.sidebarOpen);
  const [pinnedPresets, setPinnedPresets] = useState<string[]>(DEFAULT_PREFERENCES.pinnedPresets);

  // Active preset
  const [activePreset, setActivePreset] = useState('all');

  // Selection
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // ─── Load preferences from Firestore ───────────────────
  useEffect(() => {
    if (!user?.uid) return;
    getUserPreferences(user.uid, PREFS_KEY).then((data: any) => {
      if (data) {
        const merged = { ...DEFAULT_PREFERENCES, ...data } as TaskPreferences;
        setPrefs(merged);
        setView(merged.defaultView);
        setSortBy(merged.lastSortBy);
        setSortDir(merged.lastSortDir);
        setGroupBy(merged.lastGroupBy);
        setDensity(merged.density);
        setColumns(merged.columns);
        setSubtaskDisplay(merged.subtaskDisplay);
        setCalendarMode(merged.calendarMode);
        setMeMode(merged.meMode);
        setSidebarOpen(merged.sidebarOpen);
        setPinnedPresets(merged.pinnedPresets);
      }
      prefsLoaded.current = true;
    }).catch(() => { prefsLoaded.current = true; });
  }, [user?.uid]);

  // ─── Persist preferences ───────────────────────────────
  const persistPrefs = useCallback((partial: Partial<TaskPreferences>) => {
    if (!user?.uid || !prefsLoaded.current) return;
    const next = { ...prefs, ...partial };
    setPrefs(next);
    saveUserPreferences(user.uid, PREFS_KEY, next).catch(() => {});
  }, [user?.uid, prefs]);

  // ─── Load data ─────────────────────────────────────────
  const load = useCallback(async () => {
    const [rawTasks, m] = await Promise.all([getTasks(activeTeamId), getMembers()]);
    const visible = (rawTasks as any[]).filter(task => !task.deleted && canSeeResource({
      teamId: task.teamId,
      createdBy: task.createdBy,
      visibility: task.visibility || 'team',
      assignees: task.assignees,
    }));
    setTasks(visible as Task[]);
    setMembers(activeTeamId === '__all__' ? m : m.filter((x: any) => x.teamId === activeTeamId || x.teamIds?.includes(activeTeamId)));
    setLoading(false);
  }, [activeTeamId, canSeeResource]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Load saved views
  useEffect(() => {
    getSettings('taskViews').then((data: any) => {
      if (data?.views) setSavedViews(data.views);
    }).catch(() => {});
  }, []);

  // Sync selected task with updated data
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(tk => tk.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  // ─── Derived: preset-filtered tasks ────────────────────
  const presetFilteredTasks = useMemo(() => {
    let base = tasks.filter(tk => !tk.archived);

    // Me Mode: only my tasks
    if (meMode && user?.uid) {
      base = base.filter(tk => tk.assignees?.includes(user.uid));
    }

    // Apply preset filter
    if (activePreset.startsWith('saved:')) return base; // saved views use their own filters
    const preset = BUILT_IN_PRESETS.find(p => p.id === activePreset);
    if (!preset || preset.id === 'all') return base;

    if (preset.filterFn && user?.uid) {
      base = base.filter(tk => preset.filterFn!(tk, user.uid));
    }
    if (preset.filters?.status?.length) {
      base = base.filter(tk => preset.filters!.status!.includes(tk.status));
    }

    return base;
  }, [tasks, activePreset, meMode, user?.uid]);

  // ─── Derived: fully filtered + sorted ──────────────────
  const filteredTasks = useMemo(() => {
    const afterFilters = applyFilters(presetFilteredTasks, filters);
    return sortTasks(afterFilters, sortBy, sortDir);
  }, [presetFilteredTasks, filters, sortBy, sortDir]);

  // ─── Derived: groups ───────────────────────────────────
  const groups: TaskGroup[] = useMemo(() => {
    return groupTasks(filteredTasks, groupBy, members, t);
  }, [filteredTasks, groupBy, members, t]);

  // ─── Derived: counts ──────────────────────────────────
  const taskCounts = useMemo(() => {
    const nonArchived = tasks.filter(tk => !tk.archived);
    const counts: Record<string, number> = { all: nonArchived.length };
    STATUSES.forEach(s => { counts[s.id] = nonArchived.filter(tk => tk.status === s.id).length; });
    return counts;
  }, [tasks]);

  const doneCount = taskCounts.done || 0;

  const overdueCount = useMemo(() => {
    return tasks.filter(tk => !tk.archived && isOverdue(tk)).length;
  }, [tasks]);

  // ─── Empty state type ─────────────────────────────────
  const emptyStateType = useMemo(() => {
    if (filteredTasks.length > 0) return null;
    // If filters are active, it's a "no results" state
    const hasActiveFilters = filters.search || filters.status.length > 0 || filters.priority.length > 0
      || filters.assignee.length > 0 || filters.type.length > 0 || filters.tags.length > 0
      || filters.dateRange.from || filters.dateRange.to
      || filters.hasAttachments || filters.hasDependencies || filters.isBlocked
      || filters.noDate || filters.noAssignee;
    if (hasActiveFilters) return 'no-results' as const;

    // Preset-specific empty states
    switch (activePreset) {
      case 'my_tasks': return 'no-my-tasks' as const;
      case 'overdue': return 'no-overdue' as const;
      case 'today': return 'no-today' as const;
      default: return 'no-tasks' as const;
    }
  }, [filteredTasks.length, filters, activePreset]);

  // ─── CRUD handlers ─────────────────────────────────────
  const doCreate = async (data: any) => {
    if (!can('task', 'create')) return;
    const taskRef = await createTask({
      ...data,
      teamId: data.teamId || (activeTeamId === '__all__' ? '' : activeTeamId),
      createdBy: user!.uid,
      visibility: data.visibility || 'team',
    });
    await logAction({ action: 'created', resource: 'task', detail: data.title, actorId: user!.uid, actorName: me!.displayName });
    const assigneeIds = (data.assignees || []).filter((id: string) => id !== user!.uid);
    if (assigneeIds.length > 0) {
      notifyMany(assigneeIds, {
        type: 'task_assigned', title: t('tasks.assigned', { name: me!.displayName }),
        message: data.title || t('tasks.newTaskNotif'), entityType: 'task', entityId: taskRef.id,
        entityUrl: '/app/tasks', actorId: user!.uid, actorName: me!.displayName,
      }).catch(() => {});
    }
    setShowCreate(false);
    load();
  };

  const doUpdate = async (id: string, field: string, val: any, old?: any) => {
    if (!can('task', 'update')) return;
    await updateTask(id, { [field]: val });
    try { await addTaskActivity(id, { action: 'updated', field, from: String(old || ''), to: String(val), actorId: user!.uid, actorName: me!.displayName }); } catch {}
    if (field === 'assignees' && Array.isArray(val) && Array.isArray(old)) {
      const newAssignees = val.filter((uid: string) => !old.includes(uid) && uid !== user!.uid);
      const task = tasks.find(tk => tk.id === id);
      if (newAssignees.length > 0) {
        notifyMany(newAssignees, {
          type: 'task_assigned', title: t('tasks.assignedTo', { name: me!.displayName }),
          message: task?.title || t('tasks.updated'), entityType: 'task', entityId: id,
          entityUrl: '/app/tasks', actorId: user!.uid, actorName: me!.displayName,
        }).catch(() => {});
      }
    }
    // Recurring task: auto-generate next instance when marked done
    if (field === 'status' && val === 'done') {
      const task = tasks.find(tk => tk.id === id);
      if (task?.recurrence) {
        handleTaskCompletion(task).catch(() => {});
      }
    }
    load();
  };

  const doDelete = async (tk: any) => {
    if (!can('task', 'delete') && tk.createdBy !== user?.uid) return;
    if (!confirm(t('tasks.deleteConfirm', { title: tk.title }))) return;
    await softDeleteTask(tk.id);
    await logAction({ action: 'deleted', resource: 'task', detail: tk.title, actorId: user!.uid, actorName: me!.displayName });
    if (selectedTask?.id === tk.id) setSelectedTask(null);
    load();
  };

  // ─── Bulk actions ──────────────────────────────────────
  const bulkUpdate = async (field: string, value: any) => {
    if (!can('task', 'update')) return;
    const promises = Array.from(selectedIds).map(id => updateTask(id, { [field]: value }));
    await Promise.all(promises);
    setSelectedIds(new Set());
    load();
  };

  const bulkDelete = async () => {
    if (!confirm(t('tasks.bulkDeleteConfirm', { n: selectedIds.size }))) return;
    const promises = Array.from(selectedIds).map(id => softDeleteTask(id));
    await Promise.all(promises);
    setSelectedIds(new Set());
    if (selectedTask && selectedIds.has(selectedTask.id)) setSelectedTask(null);
    load();
  };

  const bulkArchive = async () => {
    if (!can('task', 'update')) return;
    const promises = Array.from(selectedIds).map(id => updateTask(id, { archived: true }));
    await Promise.all(promises);
    setSelectedIds(new Set());
    load();
  };

  const bulkAssignee = async (userId: string) => {
    if (!can('task', 'update')) return;
    const promises = Array.from(selectedIds).map(id => {
      const task = tasks.find(tk => tk.id === id);
      if (!task) return Promise.resolve();
      const current = task.assignees || [];
      if (current.includes(userId)) return Promise.resolve();
      return updateTask(id, { assignees: [...current, userId] });
    });
    await Promise.all(promises);
    setSelectedIds(new Set());
    load();
  };

  const bulkTeamChange = async (teamId: string) => {
    if (!can('task', 'update')) return;
    const promises = Array.from(selectedIds).map(id => updateTask(id, { teamId }));
    await Promise.all(promises);
    setSelectedIds(new Set());
    load();
  };

  // ─── Saved views ──────────────────────────────────────
  const handleSaveView = async () => {
    const name = prompt(t('tasks.viewName'));
    if (!name?.trim()) return;
    const sv: SavedView = {
      id: Date.now().toString(36),
      name: name.trim(),
      view, filters, sortBy, groupBy,
      createdBy: user!.uid,
      density, columns, subtaskDisplay, calendarMode,
    };
    const updated = [...savedViews, sv];
    setSavedViews(updated);
    await saveSettings('taskViews', { views: updated });
  };

  const handleLoadView = (sv: SavedView) => {
    setView(sv.view);
    setFilters(sv.filters);
    setSortBy(sv.sortBy);
    setGroupBy(sv.groupBy);
    if (sv.density) setDensity(sv.density);
    if (sv.columns) setColumns(sv.columns);
    if (sv.subtaskDisplay) setSubtaskDisplay(sv.subtaskDisplay);
    if (sv.calendarMode) setCalendarMode(sv.calendarMode);
  };

  const handleDeleteView = async (id: string) => {
    const updated = savedViews.filter(sv => sv.id !== id);
    setSavedViews(updated);
    if (activePreset === `saved:${id}`) setActivePreset('all');
    await saveSettings('taskViews', { views: updated });
  };

  const handleDuplicateView = async (sv: SavedView) => {
    const dup: SavedView = {
      ...sv,
      id: Date.now().toString(36),
      name: `${sv.name} (copy)`,
      createdBy: user!.uid,
    };
    const updated = [...savedViews, dup];
    setSavedViews(updated);
    await saveSettings('taskViews', { views: updated });
  };

  // ─── Preset change ────────────────────────────────────
  const handlePresetChange = (id: string) => {
    setActivePreset(id);
    // Reset filters when switching presets (unless loading a saved view)
    if (!id.startsWith('saved:')) {
      setFilters(EMPTY_FILTERS);
    }
  };

  // ─── Preference-aware setters ─────────────────────────
  const handleViewChange = (v: ViewType) => {
    setView(v);
    persistPrefs({ defaultView: v });
  };

  const handleDensityChange = (d: Density) => {
    setDensity(d);
    persistPrefs({ density: d });
  };

  const handleMeModeToggle = () => {
    const next = !meMode;
    setMeMode(next);
    persistPrefs({ meMode: next });
  };

  const handleSortByChange = (s: string) => {
    setSortBy(s);
    persistPrefs({ lastSortBy: s });
  };

  const handleSortDirToggle = () => {
    const next = sortDir === 'asc' ? 'desc' : 'asc';
    setSortDir(next);
    persistPrefs({ lastSortDir: next });
  };

  const handleGroupByChange = (g: string) => {
    setGroupBy(g);
    persistPrefs({ lastGroupBy: g });
  };

  const handleSidebarToggle = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    persistPrefs({ sidebarOpen: next });
  };

  const handleCalendarModeChange = (m: CalendarMode) => {
    setCalendarMode(m);
    persistPrefs({ calendarMode: m });
  };

  // ─── Keyboard shortcuts ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key) {
        case SHORTCUTS.newTask: if (can('task', 'create')) setShowCreate(true); break;
        case SHORTCUTS.search:
          e.preventDefault();
          document.getElementById('task-search')?.focus();
          break;
        case SHORTCUTS.viewList: handleViewChange('list'); break;
        case SHORTCUTS.viewBoard: handleViewChange('board'); break;
        case SHORTCUTS.viewCalendar: handleViewChange('calendar'); break;
        case SHORTCUTS.escape:
          if (selectedTask) setSelectedTask(null);
          else if (showCreate) setShowCreate(false);
          else if (selectedIds.size > 0) setSelectedIds(new Set());
          break;
        case SHORTCUTS.delete:
          if (selectedIds.size > 0) bulkDelete();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedTask, showCreate, selectedIds, can]);

  const activeTeam = teams.find((tm: any) => tm.id === activeTeamId);
  const canCreate = can('task', 'create');

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <TaskSidebar
        open={sidebarOpen}
        filters={filters}
        groupBy={groupBy}
        sortBy={sortBy}
        members={members}
        taskCounts={taskCounts}
        density={density}
        meMode={meMode}
        onFiltersChange={setFilters}
        onGroupByChange={handleGroupByChange}
        onSortByChange={handleSortByChange}
        onDensityChange={handleDensityChange}
        onMeModeToggle={handleMeModeToggle}
        onToggle={handleSidebarToggle}
      />

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-out"
        style={{ marginRight: selectedTask ? '540px' : '0' }}
      >
        {/* Toolbar */}
        <TaskToolbar
          view={view}
          filters={filters}
          search={filters.search}
          sortBy={sortBy}
          sortDir={sortDir}
          groupBy={groupBy}
          canCreate={canCreate}
          activeTeam={activeTeam}
          canSeeAllTeams={canSeeAllTeams}
          activeTeamId={activeTeamId}
          taskCount={filteredTasks.length}
          doneCount={doneCount}
          overdueCount={overdueCount}
          selectedCount={selectedIds.size}
          sidebarOpen={sidebarOpen}
          activePreset={activePreset}
          savedViews={savedViews}
          pinnedPresets={pinnedPresets}
          onViewChange={handleViewChange}
          onSearchChange={(s) => setFilters(f => ({ ...f, search: s }))}
          onFiltersChange={setFilters}
          onSortByChange={handleSortByChange}
          onSortDirToggle={handleSortDirToggle}
          onGroupByChange={handleGroupByChange}
          onNewTask={() => setShowCreate(true)}
          onClearFilters={() => setFilters(EMPTY_FILTERS)}
          onToggleSidebar={() => setSidebarOpen(true)}
          onPresetChange={handlePresetChange}
          onSaveView={handleSaveView}
          onLoadView={handleLoadView}
          onDeleteView={handleDeleteView}
          onDuplicateView={handleDuplicateView}
          onImport={can('task', 'create') ? () => setShowImport(true) : undefined}
        />

        {/* View content */}
        <div className="flex-1 overflow-hidden relative">
          {loading ? (
            <div className="px-7 py-5 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-[52px] skeleton rounded-2xl" />)}
            </div>
          ) : emptyStateType ? (
            <TaskEmptyState
              type={emptyStateType}
              canCreate={canCreate}
              onCreateTask={() => setShowCreate(true)}
              onClearFilters={() => setFilters(EMPTY_FILTERS)}
            />
          ) : (
            <AnimatePresence mode="wait">
              {view === 'list' && (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
                  <TaskListView
                    groups={groups}
                    members={members}
                    teams={teams}
                    selectedTask={selectedTask}
                    selectedIds={selectedIds}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    canUpdate={can('task', 'update')}
                    density={density}
                    columns={columns}
                    subtaskDisplay={subtaskDisplay}
                    onSelect={setSelectedTask}
                    onSelectionChange={setSelectedIds}
                    onUpdate={doUpdate}
                    onDelete={doDelete}
                    onSortChange={(field) => {
                      if (sortBy === field) handleSortDirToggle();
                      else { handleSortByChange(field); setSortDir('asc'); persistPrefs({ lastSortDir: 'asc' }); }
                    }}
                    onQuickCreate={doCreate}
                  />
                </motion.div>
              )}
              {view === 'board' && (
                <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
                  <TaskBoardView
                    groups={groups}
                    members={members}
                    teams={teams}
                    selectedTask={selectedTask}
                    canUpdate={can('task', 'update')}
                    onSelect={setSelectedTask}
                    onStatusChange={(taskId, newStatus) => doUpdate(taskId, 'status', newStatus)}
                    onQuickCreate={doCreate}
                  />
                </motion.div>
              )}
              {view === 'calendar' && (
                <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
                  <TaskCalendarView
                    tasks={filteredTasks}
                    members={members}
                    selectedTask={selectedTask}
                    calendarMode={calendarMode}
                    onSelect={setSelectedTask}
                    onDateChange={(taskId, newDate) => doUpdate(taskId, 'dueDate', newDate)}
                    onModeChange={handleCalendarModeChange}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Bulk Actions */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <TaskBulkActions
                count={selectedIds.size}
                members={members}
                teams={teams}
                onStatusChange={(status) => bulkUpdate('status', status)}
                onPriorityChange={(priority) => bulkUpdate('priority', priority)}
                onAssigneeAdd={bulkAssignee}
                onTeamChange={bulkTeamChange}
                onArchive={bulkArchive}
                onDelete={bulkDelete}
                onClear={() => setSelectedIds(new Set())}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            members={members}
            teams={teams}
            userId={user!.uid}
            userName={me!.displayName}
            canUpdate={can('task', 'update')}
            canDelete={can('task', 'delete')}
            onUpdate={doUpdate}
            onDelete={doDelete}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <TaskCreateModal
            members={members}
            teams={teams}
            activeTeamId={activeTeamId}
            onClose={() => setShowCreate(false)}
            onCreate={doCreate}
          />
        )}
      </AnimatePresence>

      {/* Import Wizard */}
      <AnimatePresence>
        {showImport && (
          <ImportWizard
            members={members}
            teamId={activeTeamId}
            userId={user!.uid}
            userName={me?.displayName || ''}
            onClose={() => setShowImport(false)}
            onComplete={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
