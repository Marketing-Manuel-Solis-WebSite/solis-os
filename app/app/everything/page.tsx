'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  getTasksPaginated, createTask, updateTask, softDeleteTask,
  getMembers, getSettings, saveSettings,
  getUserPreferences, saveUserPreferences,
} from '@/lib/db';
import {
  afterTaskCreated, afterTaskUpdated, afterTaskDeleted,
  afterTaskBulkUpdated, afterTaskBulkDeleted,
} from '@/lib/task-side-effects';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/components/notifications/toast-provider';

import TaskSidebar from '@/components/tasks/task-sidebar';
import TaskToolbar from '@/components/tasks/task-toolbar';
import TaskDetailDrawer from '@/components/tasks/task-detail-drawer';
import TaskCreateModal from '@/components/tasks/task-create-modal';
import MobileTaskForm from '@/components/mobile/mobile-task-form';
import BottomSheet from '@/components/mobile/bottom-sheet';
import { useIsMobile } from '@/lib/hooks/use-mobile-detect';
import TaskBulkActions from '@/components/tasks/task-bulk-actions';
import TaskEmptyState from '@/components/tasks/task-empty-state';
import ArtifactViewRenderer from '@/components/views/artifact-view-renderer';
import AddViewMenu from '@/components/views/add-view-menu';
import { Layers, X } from 'lucide-react';

// View registry
import '@/lib/views/register-views';
import { getView } from '@/lib/views';
import { getViewsForScope, pinView, setDefaultView, shareViewByLink } from '@/lib/views/view-db';
import type { ViewDefinition } from '@/types';

import {
  Task, ViewType, FilterState, EMPTY_FILTERS, SavedView, TaskGroup,
  STATUSES, SHORTCUTS,
  CalendarMode, Density, SubtaskDisplay,
  BUILT_IN_PRESETS, DEFAULT_PREFERENCES, TaskPreferences,
  applyFilters, sortTasks, groupTasks, isOverdue,
} from '@/components/tasks/constants';

const PREFS_KEY = 'everythingPreferences';
const FORCE_TEAM_ID = '__all__';

export default function EverythingPage() {
  const { user, me, teams, can, canSeeResource, canSeeAllTeams } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const isMobile = useIsMobile();

  // Core data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocCursorRef = useRef<any>(null);
  const PAGE_SIZE = 50;

  // Preferences (loaded from Firestore)
  const [prefs, setPrefs] = useState<TaskPreferences>(DEFAULT_PREFERENCES);
  const prefsLoaded = useRef(false);

  // View state
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
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Firestore first-class views + artifact views
  const [firestoreViews, setFirestoreViews] = useState<ViewDefinition[]>([]);
  const [activeArtifactView, setActiveArtifactView] = useState<{ type: string; id: string } | null>(null);

  // Space filter chips
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());

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

  // ─── Persist preferences (debounced) ───────────────────
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
      saveUserPreferences(user.uid!, PREFS_KEY, next).catch((err) => console.error('[Everything] save preferences failed:', err));
    }, 800);
  }, [user?.uid]);

  // ─── Load Firestore views (global scope) ──────────────
  useEffect(() => {
    if (!user?.uid) return;
    getViewsForScope('global', FORCE_TEAM_ID, user.uid)
      .then(setFirestoreViews)
      .catch(() => setFirestoreViews([]));
  }, [user?.uid]);

  // ─── Firestore view handlers ────────────────────────────
  const handlePinView = useCallback(async (viewId: string, pinned: boolean) => {
    await pinView(viewId, pinned);
    setFirestoreViews(vs => vs.map(v => v.id === viewId ? { ...v, isPinned: pinned } as any : v));
  }, []);

  const handleSetDefaultView = useCallback(async (viewId: string, isDefault: boolean) => {
    await setDefaultView(viewId, isDefault);
    setFirestoreViews(vs => vs.map(v => v.id === viewId ? { ...v, isDefault } as any : v));
  }, []);

  const handleShareViewLink = useCallback(async (viewId: string) => {
    const token = await shareViewByLink(viewId);
    setFirestoreViews(vs => vs.map(v => v.id === viewId ? { ...v, shareToken: token } as any : v));
    toast.success(t('common.linkCopied'), '');
    return token;
  }, [toast, t]);

  const handleAddArtifactView = useCallback(async (viewType: string) => {
    if (!user?.uid) return;
    setActiveArtifactView({ type: viewType, id: '' });
  }, [user?.uid]);

  // ─── Load data (always __all__) ────────────────────────
  const load = useCallback(async () => {
    lastDocCursorRef.current = null;
    const [{ items: rawTasks, lastDoc: cursor, hasMore: more }, m] = await Promise.all([
      getTasksPaginated({ teamId: FORCE_TEAM_ID, pageSize: PAGE_SIZE }),
      getMembers(),
    ]);
    lastDocCursorRef.current = cursor;
    const visible = (rawTasks as any[]).filter(task => !task.deleted && canSeeResource({
      teamId: task.teamId,
      createdBy: task.createdBy,
      visibility: task.visibility || 'team',
      assignees: task.assignees,
    }));
    setTasks(visible as Task[]);
    setHasMore(more);
    setMembers(m);
    setLoading(false);
  }, [canSeeResource]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Load saved views
  useEffect(() => {
    getSettings('everythingViews').then((data: any) => {
      if (data?.views) setSavedViews(data.views);
    }).catch((err) => console.error('[Everything] load saved views failed:', err));
  }, []);

  // Sync selected task with updated data
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(tk => tk.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  // ─── Derived: space-filtered, preset-filtered tasks ───
  const presetFilteredTasks = useMemo(() => {
    let base = tasks.filter(tk => !tk.archived);

    // Space filter chips
    if (selectedSpaces.size > 0) {
      base = base.filter(tk => selectedSpaces.has(tk.teamId));
    }

    // Me Mode
    if (meMode && user?.uid) {
      base = base.filter(tk => tk.assignees?.includes(user.uid));
    }

    // Apply preset filter
    if (activePreset.startsWith('saved:')) return base;
    const preset = BUILT_IN_PRESETS.find(p => p.id === activePreset);
    if (!preset || preset.id === 'all') return base;

    if (preset.filterFn && user?.uid) {
      base = base.filter(tk => preset.filterFn!(tk, user.uid));
    }
    if (preset.filters?.status?.length) {
      base = base.filter(tk => preset.filters!.status!.includes(tk.status));
    }

    return base;
  }, [tasks, activePreset, meMode, user?.uid, selectedSpaces]);

  // ─── Derived: fully filtered + sorted ──────────────────
  const filteredTasks = useMemo(() => {
    const afterFilters = applyFilters(presetFilteredTasks, filters);
    return sortTasks(afterFilters, sortBy, sortDir);
  }, [presetFilteredTasks, filters, sortBy, sortDir]);

  // ─── Derived: groups (with space grouping support) ────
  const groups: TaskGroup[] = useMemo(() => {
    return groupTasks(filteredTasks, groupBy, members, t, teams);
  }, [filteredTasks, groupBy, members, t, teams]);

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
    const hasActiveFilters = filters.search || filters.status.length > 0 || filters.priority.length > 0
      || filters.assignee.length > 0 || filters.type.length > 0 || filters.tags.length > 0
      || filters.dateRange.from || filters.dateRange.to
      || filters.hasAttachments || filters.hasDependencies || filters.isBlocked
      || filters.noDate || filters.noAssignee;
    if (hasActiveFilters || selectedSpaces.size > 0) return 'no-results' as const;

    switch (activePreset) {
      case 'my_tasks': return 'no-my-tasks' as const;
      case 'overdue': return 'no-overdue' as const;
      case 'today': return 'no-today' as const;
      default: return 'no-tasks' as const;
    }
  }, [filteredTasks.length, filters, activePreset, selectedSpaces]);

  // ─── Space counts (for filter chips) ──────────────────
  const spaceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks.filter(tk => !tk.archived)) {
      if (task.teamId) {
        counts.set(task.teamId, (counts.get(task.teamId) || 0) + 1);
      }
    }
    return counts;
  }, [tasks]);

  // ─── CRUD handlers ─────────────────────────────────────
  const doCreate = async (data: any) => {
    if (!can('task', 'create')) return;
    const taskRef = await createTask({
      ...data,
      teamId: data.teamId || '',
      createdBy: user!.uid,
      visibility: data.visibility || 'team',
    });
    await afterTaskCreated({
      taskId: taskRef.id,
      task: data,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setShowCreate(false);
    load();
  };

  const doUpdate = async (id: string, field: string, val: any, old?: any) => {
    if (!can('task', 'update')) return;
    await updateTask(id, { [field]: val });
    const task = tasks.find(tk => tk.id === id) || {};
    const result = await afterTaskUpdated({
      taskId: id,
      task,
      field,
      from: old,
      to: val,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    if (field === 'status' && val === 'done') {
      const recurrenceEffect = result.effects.find(e => e.name === 'handleTaskCompletion');
      if (recurrenceEffect && !recurrenceEffect.success) {
        toast.error(t('recurrence.generationFailed'));
      }
    }
    load();
  };

  const doDelete = async (tk: any) => {
    if (!can('task', 'delete') && tk.createdBy !== user?.uid) return;
    if (!confirm(t('tasks.deleteConfirm', { title: tk.title }))) return;
    await softDeleteTask(tk.id);
    await afterTaskDeleted({
      taskId: tk.id,
      task: tk,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    if (selectedTask?.id === tk.id) setSelectedTask(null);
    load();
  };

  // ─── Bulk actions ──────────────────────────────────────
  const bulkUpdate = async (field: string, value: any) => {
    if (!can('task', 'update')) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => updateTask(id, { [field]: value })));
    await afterTaskBulkUpdated({
      updates: ids.map(id => ({ taskId: id, task: tasks.find(tk => tk.id === id) || {} })),
      field,
      value,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setSelectedIds(new Set());
    load();
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
    load();
  };

  const bulkArchive = async () => {
    if (!can('task', 'update')) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => updateTask(id, { archived: true })));
    await afterTaskBulkUpdated({
      updates: ids.map(id => ({ taskId: id, task: tasks.find(tk => tk.id === id) || {} })),
      field: 'archived',
      value: true,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setSelectedIds(new Set());
    load();
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
        field: 'assignees',
        value: userId,
        actor: { actorId: user!.uid, actorName: me!.displayName },
      });
    }
    setSelectedIds(new Set());
    load();
  };

  const bulkTeamChange = async (teamId: string) => {
    if (!can('task', 'update')) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => updateTask(id, { teamId })));
    await afterTaskBulkUpdated({
      updates: ids.map(id => ({ taskId: id, task: tasks.find(tk => tk.id === id) || {} })),
      field: 'teamId',
      value: teamId,
      actor: { actorId: user!.uid, actorName: me!.displayName },
    });
    setSelectedIds(new Set());
    load();
  };

  // ─── Load more (cursor-based) ───────────────────────
  const handleLoadMore = async () => {
    if (!lastDocCursorRef.current) return;
    setLoadingMore(true);
    try {
      const { items: rawTasks, lastDoc: cursor, hasMore: more } = await getTasksPaginated({
        teamId: FORCE_TEAM_ID,
        pageSize: PAGE_SIZE,
        lastDoc: lastDocCursorRef.current,
      });
      lastDocCursorRef.current = cursor;
      const visible = (rawTasks as any[]).filter(task => !task.deleted && canSeeResource({
        teamId: task.teamId,
        createdBy: task.createdBy,
        visibility: task.visibility || 'team',
        assignees: task.assignees,
      }));
      setTasks(prev => [...prev, ...(visible as Task[])]);
      setHasMore(more);
    } finally {
      setLoadingMore(false);
    }
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
    await saveSettings('everythingViews', { views: updated });
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
    await saveSettings('everythingViews', { views: updated });
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
    await saveSettings('everythingViews', { views: updated });
  };

  // ─── Preset change ────────────────────────────────────
  const handlePresetChange = (id: string) => {
    setActivePreset(id);
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

  // ─── Space filter toggle ──────────────────────────────
  const toggleSpaceFilter = (spaceId: string) => {
    setSelectedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
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
        case SHORTCUTS.viewTable: handleViewChange('table'); break;
        case SHORTCUTS.viewGantt: handleViewChange('gantt'); break;
        case SHORTCUTS.viewTimeline: handleViewChange('timeline'); break;
        case SHORTCUTS.viewWorkload: handleViewChange('workload'); break;
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
        style={{ marginRight: selectedTask ? '552px' : '0' }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <Layers className="h-4 w-4 text-[var(--accent)]" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            {t('everything.title')}
          </span>
          <span className="text-[12px] text-[var(--text-muted)]">
            {t('everything.subtitle')}
          </span>
        </div>

        {/* Space filter chips */}
        {teams.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pb-1 flex-wrap">
            {selectedSpaces.size > 0 && (
              <button
                onClick={() => setSelectedSpaces(new Set())}
                className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all duration-200"
              >
                <X className="h-3 w-3" />
                {t('common.clearAll')}
              </button>
            )}
            {teams.filter((tm: any) => tm.status !== 'archived' && spaceCounts.has(tm.id)).map((tm: any) => {
              const isActive = selectedSpaces.has(tm.id);
              const count = spaceCounts.get(tm.id) || 0;
              return (
                <button
                  key={tm.id}
                  onClick={() => toggleSpaceFilter(tm.id)}
                  className={`flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                  }`}
                >
                  {tm.icon && <span className="text-[10px]">{tm.icon}</span>}
                  <span>{tm.name}</span>
                  <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Toolbar */}
        <TaskToolbar
          view={view}
          filters={filters}
          search={filters.search}
          sortBy={sortBy}
          sortDir={sortDir}
          groupBy={groupBy}
          canCreate={canCreate}
          activeTeam={undefined}
          canSeeAllTeams={canSeeAllTeams}
          activeTeamId={FORCE_TEAM_ID}
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
          onClearFilters={() => { setFilters(EMPTY_FILTERS); setSelectedSpaces(new Set()); }}
          onToggleSidebar={() => setSidebarOpen(true)}
          onPresetChange={handlePresetChange}
          onSaveView={handleSaveView}
          onLoadView={handleLoadView}
          onDeleteView={handleDeleteView}
          onDuplicateView={handleDuplicateView}
          firestoreViews={firestoreViews}
          onPinView={(id: string) => handlePinView(id, true)}
          onSetDefaultView={(id: string) => handleSetDefaultView(id, true)}
          onShareViewLink={(id: string) => { handleShareViewLink(id); }}
        />

        {/* Artifact view selector */}
        <div className="flex items-center gap-2 px-4 pb-1">
          <AddViewMenu
            onSelect={(viewType) => {
              const artifactTypes = ['dashboard', 'doc', 'form', 'whiteboard', 'embed'];
              if (artifactTypes.includes(viewType)) {
                handleAddArtifactView(viewType);
              } else {
                handleViewChange(viewType);
              }
            }}
            disabledTypes={[]}
          />
          {activeArtifactView && (
            <button
              onClick={() => setActiveArtifactView(null)}
              className="text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              {t('common.back')} {lang === 'es' ? 'a tareas' : 'to tasks'}
            </button>
          )}
        </div>

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
              onClearFilters={() => { setFilters(EMPTY_FILTERS); setSelectedSpaces(new Set()); }}
            />
          ) : activeArtifactView ? (
              <div className="h-full">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-sm text-[var(--text-muted)] capitalize">{activeArtifactView.type} view</span>
                  <button
                    onClick={() => setActiveArtifactView(null)}
                    className="ml-auto text-[12px] text-[var(--accent)] hover:underline"
                  >
                    {t('common.back')} {lang === 'es' ? 'a tareas' : 'to tasks'}
                  </button>
                </div>
                <ArtifactViewRenderer
                  artifactType={activeArtifactView.type as any}
                  artifactId={activeArtifactView.id}
                  scopeType="global"
                  scopeId={FORCE_TEAM_ID}
                  tasks={filteredTasks as any}
                  goals={[]}
                  members={members}
                  onArtifactIdChange={(newId) => setActiveArtifactView(prev => prev ? { ...prev, id: newId } : prev)}
                />
              </div>
            ) : (
            <AnimatePresence mode="wait">
              {(() => {
                const entry = getView(view);
                if (!entry) return null;
                const ViewComponent = entry.component;
                return (
                  <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
                    <ViewComponent
                      groups={groups}
                      tasks={filteredTasks as any}
                      members={members}
                      teams={teams}
                      selectedTask={selectedTask as any}
                      canUpdate={can('task', 'update')}
                      onSelect={setSelectedTask as any}
                      onUpdate={doUpdate as any}
                      onStatusChange={(taskId: string, newStatus: string) => doUpdate(taskId, 'status', newStatus)}
                      onDelete={doDelete as any}
                      onQuickCreate={doCreate as any}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={(field: string) => {
                        if (sortBy === field) handleSortDirToggle();
                        else { handleSortByChange(field); setSortDir('asc'); persistPrefs({ lastSortDir: 'asc' }); }
                      }}
                      density={density}
                      columns={columns}
                      subtaskDisplay={subtaskDisplay}
                      calendarMode={calendarMode}
                      onModeChange={handleCalendarModeChange}
                      onDateChange={(taskId: string, newDate: Date) => doUpdate(taskId, 'dueDate', newDate)}
                    />
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          )}

          {/* Has More indicator */}
          {hasMore && !loading && (
            <div className="px-7 py-3 flex items-center justify-center gap-3 border-t border-[var(--border-primary)]">
              <span className="text-[13px] text-[var(--text-muted)]">
                {t('common.showingItems', { n: tasks.length })} — {t('common.moreAvailable')}
              </span>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] text-[13px] font-medium hover:bg-[var(--accent)]/20 transition disabled:opacity-50"
              >
                {loadingMore ? t('common.loading') : t('common.loadMore')}
              </button>
            </div>
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
        {showCreate && !isMobile && (
          <TaskCreateModal
            members={members}
            teams={teams}
            activeTeamId={FORCE_TEAM_ID}
            onClose={() => setShowCreate(false)}
            onCreate={doCreate}
          />
        )}
      </AnimatePresence>
      {showCreate && isMobile && (
        <BottomSheet open={showCreate} onClose={() => setShowCreate(false)} title={lang === 'es' ? 'Nueva Tarea' : 'New Task'}>
          <MobileTaskForm
            mode="create"
            members={members}
            onSave={async (data) => { await doCreate(data); setShowCreate(false); }}
            onCancel={() => setShowCreate(false)}
          />
        </BottomSheet>
      )}
    </div>
  );
}
