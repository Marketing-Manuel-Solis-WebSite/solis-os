'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import {
  createTask, updateTask, softDeleteTask,
  getUserPreferences, saveUserPreferences,
  getSharedSpaceViews, saveSharedSpaceViews,
  getLists, ensureDefaultList,
  type ListData,
} from '@/lib/db';
import {
  afterTaskCreated, afterTaskUpdated, afterTaskDeleted,
  afterTaskBulkUpdated, afterTaskBulkDeleted,
} from '@/lib/task-side-effects';
import { AnimatePresence, motion } from 'framer-motion';

import TaskSidebar from '@/components/tasks/task-sidebar';
import TaskToolbar from '@/components/tasks/task-toolbar';
import TaskListView from '@/components/tasks/task-list-view';
import TaskBoardView from '@/components/tasks/task-board-view';
import TaskCalendarView from '@/components/tasks/task-calendar-view';
import TaskDetailDrawer from '@/components/tasks/task-detail-drawer';
import TaskCreateModal from '@/components/tasks/task-create-modal';
import TaskBulkActions from '@/components/tasks/task-bulk-actions';
import TaskEmptyState from '@/components/tasks/task-empty-state';

import {
  Task, ViewType, FilterState, EMPTY_FILTERS, SavedView, TaskGroup,
  STATUSES, CalendarMode, Density, SubtaskDisplay,
  BUILT_IN_PRESETS, DEFAULT_PREFERENCES, TaskPreferences,
  applyFilters, sortTasks, groupTasks, isOverdue,
} from '@/components/tasks/constants';

// Space-specific presets: adds "created_by_me" to the standard set
const SPACE_PRESETS = [
  ...BUILT_IN_PRESETS,
  {
    id: 'created_by_me',
    isBuiltIn: true,
    filterFn: (t: Task, uid: string) => t.createdBy === uid,
  },
];

interface SpaceTasksPanelProps {
  spaceId: string;
  listId?: string | null;  // If set, only show tasks for this list
  tasks: Task[];
  members: any[];
  teams: any[];
  onReload: () => void;
}

export default function SpaceTasksPanel({ spaceId, listId, tasks, members, teams, onReload }: SpaceTasksPanelProps) {
  const { user, me, can, canSeeAllTeams } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const PREFS_KEY = `spaceTaskPrefs_${spaceId}`;
  const VIEWS_KEY = `spaceViews_${spaceId}`;

  // ─── Preferences ─────────────────────────────────────
  const [prefs, setPrefs] = useState<TaskPreferences>(DEFAULT_PREFERENCES);
  const prefsLoaded = useRef(false);
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
  const [sidebarOpen, setSidebarOpen] = useState(false); // compact default for space
  const [pinnedPresets, setPinnedPresets] = useState<string[]>(['all', 'my_tasks', 'today', 'created_by_me']);

  // Active preset & selection
  const [activePreset, setActivePreset] = useState('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [sharedViews, setSharedViews] = useState<SavedView[]>([]);
  const canManageShared = can('task', 'update') && (me?.role === 'owner' || me?.role === 'admin' || me?.role === 'manager');

  // Lists for this space (used for list selector in create/detail/bulk)
  const [spaceLists, setSpaceLists] = useState<ListData[]>([]);
  const [defaultListId, setDefaultListId] = useState<string | null>(null);

  // Load lists; only managers bootstrap the default "General" list
  useEffect(() => {
    if (!user?.uid || !spaceId) return;
    getLists(spaceId).then(async (allLists) => {
      if (allLists.length === 0 && canManageShared) {
        // Manager in empty space — create default "General" list
        try {
          const defList = await ensureDefaultList(spaceId, user.uid);
          setDefaultListId(defList.id || null);
          const refreshed = await getLists(spaceId);
          setSpaceLists(refreshed);
        } catch {
          // If creation fails (e.g., rule race), just show empty
          setSpaceLists([]);
        }
      } else {
        setSpaceLists(allLists);
        const general = allLists.find(l => l.name === 'General');
        setDefaultListId(general?.id || allLists[0]?.id || null);
      }
    }).catch(() => {});
  }, [user?.uid, spaceId, canManageShared]);

  // ─── Load preferences from Firestore ──────────────────
  useEffect(() => {
    if (!user?.uid || !spaceId) return;
    prefsLoaded.current = false;
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
        if (merged.pinnedPresets?.length) setPinnedPresets(merged.pinnedPresets);
      }
      prefsLoaded.current = true;
    }).catch(() => { prefsLoaded.current = true; });
  }, [user?.uid, spaceId]);

  // ─── Load saved views (private + shared) ─────────────────
  useEffect(() => {
    if (!spaceId) return;
    // Load personal saved views
    if (user?.uid) {
      getUserPreferences(user.uid, VIEWS_KEY).then((data: any) => {
        if (data?.views) setSavedViews(data.views);
      }).catch(() => {});
    }
    // Load shared space views
    getSharedSpaceViews(spaceId).then((data: any) => {
      if (data?.views) setSharedViews(data.views);
    }).catch(() => {});
  }, [user?.uid, spaceId]);

  // ─── Debounced preference persistence ──────────────────
  const prefsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefs = useRef<TaskPreferences>(prefs);
  pendingPrefs.current = prefs;

  const persistPrefs = useCallback((partial: Partial<TaskPreferences>) => {
    if (!user?.uid || !prefsLoaded.current) return;
    const next = { ...pendingPrefs.current, ...partial };
    setPrefs(next);
    pendingPrefs.current = next;
    if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current);
    prefsSaveTimer.current = setTimeout(() => {
      saveUserPreferences(user.uid!, PREFS_KEY, next).catch(err => console.error('[SpaceTasks] save prefs failed:', err));
    }, 800);
  }, [user?.uid, PREFS_KEY]);

  // Sync selected task with updated tasks
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(tk => tk.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  // ─── Derived data ──────────────────────────────────────
  const presetFilteredTasks = useMemo(() => {
    let base = tasks.filter(tk => !tk.archived && !tk.deleted);
    // Scope to list if listId is provided
    if (listId) {
      base = base.filter(tk => tk.listId === listId);
    }
    if (meMode && user?.uid) {
      base = base.filter(tk => tk.assignees?.includes(user.uid));
    }
    if (activePreset.startsWith('saved:') || activePreset.startsWith('shared:')) return base;
    const preset = SPACE_PRESETS.find(p => p.id === activePreset);
    if (!preset || preset.id === 'all') return base;
    if (preset.filterFn && user?.uid) {
      base = base.filter(tk => preset.filterFn!(tk, user.uid));
    }
    if (preset.filters?.status?.length) {
      base = base.filter(tk => preset.filters!.status!.includes(tk.status));
    }
    return base;
  }, [tasks, activePreset, meMode, user?.uid]);

  const filteredTasks = useMemo(() => {
    const afterFilters = applyFilters(presetFilteredTasks, filters);
    return sortTasks(afterFilters, sortBy, sortDir);
  }, [presetFilteredTasks, filters, sortBy, sortDir]);

  const groups: TaskGroup[] = useMemo(() => {
    return groupTasks(filteredTasks, groupBy, members, t);
  }, [filteredTasks, groupBy, members, t]);

  const taskCounts = useMemo(() => {
    const nonArchived = tasks.filter(tk => !tk.archived && !tk.deleted);
    const counts: Record<string, number> = { all: nonArchived.length };
    STATUSES.forEach(s => { counts[s.id] = nonArchived.filter(tk => tk.status === s.id).length; });
    return counts;
  }, [tasks]);

  const doneCount = taskCounts.done || 0;
  const overdueCount = useMemo(() => tasks.filter(tk => !tk.archived && !tk.deleted && isOverdue(tk)).length, [tasks]);

  const emptyStateType = useMemo(() => {
    if (filteredTasks.length > 0) return null;
    const hasActive = filters.search || filters.status.length || filters.priority.length
      || filters.assignee.length || filters.type.length || filters.tags.length
      || filters.dateRange.from || filters.dateRange.to
      || filters.hasAttachments || filters.hasDependencies || filters.isBlocked
      || filters.noDate || filters.noAssignee;
    if (hasActive) return 'no-results' as const;
    switch (activePreset) {
      case 'my_tasks': return 'no-my-tasks' as const;
      case 'overdue': return 'no-overdue' as const;
      case 'today': return 'no-today' as const;
      default: return 'no-tasks' as const;
    }
  }, [filteredTasks.length, filters, activePreset]);

  // ─── CRUD ──────────────────────────────────────────────
  const doCreate = async (data: any) => {
    if (!can('task', 'create')) return;
    // Resolve listId: explicit prop > user selection > space default > null
    const resolvedListId = listId || data.listId || defaultListId || null;
    const taskRef = await createTask({
      ...data,
      teamId: spaceId,
      listId: resolvedListId,
      createdBy: user!.uid,
      visibility: data.visibility || 'team',
    });
    await afterTaskCreated({
      taskId: taskRef.id,
      task: data,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setShowCreate(false);
    onReload();
  };

  const doUpdate = async (id: string, field: string, val: any, old?: any) => {
    if (!can('task', 'update')) return;
    await updateTask(id, { [field]: val });
    const task = tasks.find(tk => tk.id === id) || {};
    const result = await afterTaskUpdated({
      taskId: id, task, field, from: old, to: val,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    if (field === 'status' && val === 'done') {
      const recurrenceEffect = result.effects.find(e => e.name === 'handleTaskCompletion');
      if (recurrenceEffect && !recurrenceEffect.success) toast.error(t('recurrence.generationFailed'));
    }
    onReload();
  };

  const doDelete = async (tk: any) => {
    if (!can('task', 'delete') && tk.createdBy !== user?.uid) return;
    if (!confirm(t('tasks.deleteConfirm', { title: tk.title }))) return;
    await softDeleteTask(tk.id);
    await afterTaskDeleted({
      taskId: tk.id, task: tk,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    if (selectedTask?.id === tk.id) setSelectedTask(null);
    onReload();
  };

  // ─── Bulk ──────────────────────────────────────────────
  const bulkUpdate = async (field: string, value: any) => {
    if (!can('task', 'update')) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => updateTask(id, { [field]: value })));
    await afterTaskBulkUpdated({
      updates: ids.map(id => ({ taskId: id, task: tasks.find(tk => tk.id === id) || {} })),
      field, value,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setSelectedIds(new Set());
    onReload();
  };

  const bulkDelete = async () => {
    if (!can('task', 'delete')) return;
    if (!confirm(t('tasks.bulkDeleteConfirm', { n: selectedIds.size }))) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => softDeleteTask(id)));
    await afterTaskBulkDeleted({
      tasks: ids.map(id => ({ taskId: id, task: tasks.find(tk => tk.id === id) || {} })),
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setSelectedIds(new Set());
    if (selectedTask && selectedIds.has(selectedTask.id)) setSelectedTask(null);
    onReload();
  };

  const bulkArchive = async () => {
    if (!can('task', 'update')) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => updateTask(id, { archived: true })));
    await afterTaskBulkUpdated({
      updates: ids.map(id => ({ taskId: id, task: tasks.find(tk => tk.id === id) || {} })),
      field: 'archived', value: true,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setSelectedIds(new Set());
    onReload();
  };

  const bulkAssignee = async (userId: string) => {
    if (!can('task', 'update')) return;
    const ids = Array.from(selectedIds);
    const updated: string[] = [];
    await Promise.all(ids.map(id => {
      const task = tasks.find(tk => tk.id === id);
      if (!task) return Promise.resolve();
      const current = task.assignees || [];
      if (current.includes(userId)) return Promise.resolve();
      updated.push(id);
      return updateTask(id, { assignees: [...current, userId] });
    }));
    if (updated.length > 0) {
      await afterTaskBulkUpdated({
        updates: updated.map(id => ({ taskId: id, task: tasks.find(tk => tk.id === id) || {} })),
        field: 'assignees', value: userId,
        actor: { actorId: user!.uid, actorName: me!.displayName },
      });
    }
    setSelectedIds(new Set());
    onReload();
  };

  // ─── Saved views ───────────────────────────────────────
  const handleSaveView = async () => {
    const name = prompt(t('tasks.viewName'));
    if (!name?.trim() || !user?.uid) return;
    const sv: SavedView = {
      id: Date.now().toString(36),
      name: name.trim(),
      view, filters, sortBy, groupBy,
      createdBy: user.uid,
      density, columns, subtaskDisplay, calendarMode,
    };
    const updated = [...savedViews, sv];
    setSavedViews(updated);
    await saveUserPreferences(user.uid, VIEWS_KEY, { views: updated });
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
    if (!user?.uid) return;
    const updated = savedViews.filter(sv => sv.id !== id);
    setSavedViews(updated);
    if (activePreset === `saved:${id}`) setActivePreset('all');
    await saveUserPreferences(user.uid, VIEWS_KEY, { views: updated });
  };

  const handleDuplicateView = async (sv: SavedView) => {
    if (!user?.uid) return;
    const dup: SavedView = { ...sv, id: Date.now().toString(36), name: `${sv.name} (copy)`, createdBy: user.uid };
    const updated = [...savedViews, dup];
    setSavedViews(updated);
    await saveUserPreferences(user.uid, VIEWS_KEY, { views: updated });
  };

  // ─── Shared view handlers ─────────────────────────────
  const handleDeleteSharedView = async (id: string) => {
    const updated = sharedViews.filter(sv => sv.id !== id);
    setSharedViews(updated);
    if (activePreset === `shared:${id}`) setActivePreset('all');
    await saveSharedSpaceViews(spaceId, { views: updated });
  };

  const handleDuplicateSharedToPrivate = async (sv: SavedView) => {
    if (!user?.uid) return;
    const dup: SavedView = { ...sv, id: Date.now().toString(36), name: `${sv.name} (copy)`, shared: false, createdBy: user.uid };
    const updated = [...savedViews, dup];
    setSavedViews(updated);
    await saveUserPreferences(user.uid, VIEWS_KEY, { views: updated });
  };

  const handlePromoteView = async (sv: SavedView) => {
    // Copy to shared views
    const sharedCopy: SavedView = { ...sv, id: Date.now().toString(36), shared: true };
    const updatedShared = [...sharedViews, sharedCopy];
    setSharedViews(updatedShared);
    await saveSharedSpaceViews(spaceId, { views: updatedShared });
    // Remove from private views
    if (user?.uid) {
      const updatedPrivate = savedViews.filter(v => v.id !== sv.id);
      setSavedViews(updatedPrivate);
      await saveUserPreferences(user.uid, VIEWS_KEY, { views: updatedPrivate });
    }
  };

  const handleDemoteView = async (id: string) => {
    if (!user?.uid) return;
    const sv = sharedViews.find(v => v.id === id);
    if (!sv) return;
    // Copy to private views
    const privateCopy: SavedView = { ...sv, id: Date.now().toString(36), shared: false, createdBy: user.uid };
    const updatedPrivate = [...savedViews, privateCopy];
    setSavedViews(updatedPrivate);
    await saveUserPreferences(user.uid, VIEWS_KEY, { views: updatedPrivate });
    // Remove from shared
    const updatedShared = sharedViews.filter(v => v.id !== id);
    setSharedViews(updatedShared);
    if (activePreset === `shared:${id}`) setActivePreset('all');
    await saveSharedSpaceViews(spaceId, { views: updatedShared });
  };

  // ─── Preset change ─────────────────────────────────────
  const handlePresetChange = (id: string) => {
    setActivePreset(id);
    if (!id.startsWith('saved:') && !id.startsWith('shared:')) setFilters(EMPTY_FILTERS);
  };

  // ─── Preference-aware setters ──────────────────────────
  const handleViewChange = (v: ViewType) => { setView(v); persistPrefs({ defaultView: v }); };
  const handleDensityChange = (d: Density) => { setDensity(d); persistPrefs({ density: d }); };
  const handleMeModeToggle = () => { const n = !meMode; setMeMode(n); persistPrefs({ meMode: n }); };
  const handleSortByChange = (s: string) => { setSortBy(s); persistPrefs({ lastSortBy: s }); };
  const handleSortDirToggle = () => { const n = sortDir === 'asc' ? 'desc' : 'asc'; setSortDir(n); persistPrefs({ lastSortDir: n }); };
  const handleGroupByChange = (g: string) => { setGroupBy(g); persistPrefs({ lastGroupBy: g }); };
  const handleSidebarToggle = () => { const n = !sidebarOpen; setSidebarOpen(n); persistPrefs({ sidebarOpen: n }); };
  const handleCalendarModeChange = (m: CalendarMode) => { setCalendarMode(m); persistPrefs({ calendarMode: m }); };

  const canCreate = can('task', 'create');

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
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

      {/* Main */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-out"
        style={{ marginRight: selectedTask ? '480px' : '0' }}
      >
        <TaskToolbar
          view={view}
          filters={filters}
          search={filters.search}
          sortBy={sortBy}
          sortDir={sortDir}
          groupBy={groupBy}
          canCreate={canCreate}
          taskCount={filteredTasks.length}
          doneCount={doneCount}
          overdueCount={overdueCount}
          selectedCount={selectedIds.size}
          sidebarOpen={sidebarOpen}
          activePreset={activePreset}
          savedViews={savedViews}
          pinnedPresets={pinnedPresets}
          onViewChange={handleViewChange}
          onSearchChange={s => setFilters(f => ({ ...f, search: s }))}
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
          allPresets={SPACE_PRESETS}
          sharedViews={sharedViews}
          onDeleteSharedView={canManageShared ? handleDeleteSharedView : undefined}
          onDuplicateSharedView={handleDuplicateSharedToPrivate}
          onPromoteView={canManageShared ? handlePromoteView : undefined}
          onDemoteView={canManageShared ? handleDemoteView : undefined}
          canManageShared={canManageShared}
        />

        {/* View content */}
        <div className="flex-1 overflow-hidden relative">
          {emptyStateType ? (
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
                    onSortChange={field => {
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

          {/* Bulk actions */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <TaskBulkActions
                count={selectedIds.size}
                members={members}
                teams={teams}
                lists={spaceLists}
                onStatusChange={status => bulkUpdate('status', status)}
                onPriorityChange={priority => bulkUpdate('priority', priority)}
                onAssigneeAdd={bulkAssignee}
                onTeamChange={() => {}} // Not applicable within a space
                onListChange={listVal => bulkUpdate('listId', listVal)}
                onArchive={bulkArchive}
                onDelete={bulkDelete}
                onClear={() => setSelectedIds(new Set())}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Task detail drawer */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            members={members}
            teams={teams}
            lists={spaceLists}
            userId={user?.uid || ''}
            userName={me?.displayName || ''}
            canUpdate={can('task', 'update')}
            canDelete={can('task', 'delete')}
            onClose={() => setSelectedTask(null)}
            onUpdate={doUpdate}
            onDelete={doDelete}
          />
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <TaskCreateModal
            members={members}
            teams={teams}
            activeTeamId={spaceId}
            lists={spaceLists}
            defaultListId={listId || defaultListId}
            onClose={() => setShowCreate(false)}
            onCreate={doCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
