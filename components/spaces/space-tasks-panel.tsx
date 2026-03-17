'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import { useFeatureFlag } from '@/lib/feature-flags';
import {
  createTask, updateTask, softDeleteTask,
  getUserPreferences, saveUserPreferences,
  getSharedSpaceViews, saveSharedSpaceViews,
  getLists, createList, updateList,
  type ListData,
} from '@/lib/db';
import {
  getViewsForScope, createView as createFirestoreView,
  updateView as updateFirestoreView, deleteView as deleteFirestoreView,
  pinView, setDefaultView, shareViewByLink,
} from '@/lib/views/view-db';
import { getCurrentOrgId } from '@/lib/org';
import type { ViewDefinition } from '@/types';
import {
  afterTaskCreated, afterTaskUpdated, afterTaskDeleted,
  afterTaskBulkUpdated, afterTaskBulkDeleted,
} from '@/lib/task-side-effects';
import { AnimatePresence, motion } from 'framer-motion';
import ListAccessModal from '@/components/lists/list-access-modal';

import TaskSidebar from '@/components/tasks/task-sidebar';
import TaskToolbar from '@/components/tasks/task-toolbar';
import TaskDetailDrawer from '@/components/tasks/task-detail-drawer';
import TaskCreateModal from '@/components/tasks/task-create-modal';
import TaskBulkActions from '@/components/tasks/task-bulk-actions';
import TaskEmptyState from '@/components/tasks/task-empty-state';

// View registry — dynamic view rendering
import '@/lib/views/register-views';
import { getView } from '@/lib/views';

import ArtifactViewRenderer from '@/components/views/artifact-view-renderer';
import AddViewMenu from '@/components/views/add-view-menu';

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
  const [activeArtifactViewId, setActiveArtifactViewId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [sharedViews, setSharedViews] = useState<SavedView[]>([]);
  const [firestoreViews, setFirestoreViews] = useState<ViewDefinition[]>([]);
  const canManageShared = can('task', 'update') && (me?.role === 'owner' || me?.role === 'admin' || me?.role === 'manager');

  // ─── View autosave state ────────────────────────────────
  const [viewSaveStatus, setViewSaveStatus] = useState<null | 'saving' | 'saved'>(null);
  const viewAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewSavedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedViewConfig = useRef<string | null>(null); // JSON snapshot of the view config when loaded

  // Feature flag: granular permissions (per-list ACL)
  const granularPermsEnabled = useFeatureFlag('granular-permissions');

  // List access modal state
  const [accessModalList, setAccessModalList] = useState<ListData | null>(null);

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
          const ref = await createList({ spaceId, folderId: null, name: 'General', position: 0, createdBy: user.uid });
          const defList: ListData = { id: ref.id, spaceId, folderId: null, name: 'General', position: 0, createdBy: user.uid };
          setDefaultListId(defList.id || null);
          setSpaceLists([defList]);
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

  // ─── Load Firestore views (first-class view system) ────
  useEffect(() => {
    if (!user?.uid || !spaceId) return;
    getViewsForScope('space', spaceId, user.uid)
      .then(setFirestoreViews)
      .catch(() => {});
  }, [user?.uid, spaceId]);

  const reloadFirestoreViews = useCallback(() => {
    if (!user?.uid || !spaceId) return;
    getViewsForScope('space', spaceId, user.uid)
      .then(setFirestoreViews)
      .catch(() => {});
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

    // Also persist to Firestore first-class views
    try {
      await createFirestoreView({
        orgId: getCurrentOrgId(),
        scopeType: 'space',
        scopeId: spaceId,
        name: name.trim(),
        viewType: view,
        visibility: 'private',
        isDefault: false,
        isPinned: false,
        position: savedViews.length,
        config: { filters: filters as any, sortBy, sortDir, groupBy, density, columns, subtaskDisplay, calendarMode },
        sharedWith: [],
        createdBy: user.uid,
      });
      reloadFirestoreViews();
    } catch (err) {
      console.error('[SpaceTasks] createView failed:', err);
    }
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
    // Snapshot the loaded config for autosave change detection
    lastSavedViewConfig.current = JSON.stringify({
      view: sv.view, filters: sv.filters, sortBy: sv.sortBy, groupBy: sv.groupBy,
      density: sv.density, columns: sv.columns, subtaskDisplay: sv.subtaskDisplay, calendarMode: sv.calendarMode,
    });
    setViewSaveStatus(null);
  };

  const handleDeleteView = async (id: string) => {
    if (!user?.uid) return;
    // Guard: check if a corresponding Firestore view is required
    const fsView = firestoreViews.find(v => v.id === id);
    if (fsView?.visibility === 'required') {
      toast.error(t('views.cannotDeleteRequired'));
      return;
    }
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
    // Guard: check if this Firestore view is required
    const fsView = firestoreViews.find(v => v.id === id);
    if (fsView?.visibility === 'required') {
      toast.error(t('views.cannotDeleteRequired'));
      return;
    }
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
    // Update Firestore view visibility: private -> public
    const fsView = firestoreViews.find(v => v.name === sv.name && v.createdBy === sv.createdBy);
    if (fsView) {
      try {
        await updateFirestoreView(fsView.id, { visibility: 'public' });
        reloadFirestoreViews();
      } catch (err) {
        console.error('[SpaceTasks] promote view failed:', err);
      }
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
    // Update Firestore view visibility: public -> private
    const fsView = firestoreViews.find(v => v.name === sv.name && v.visibility === 'public');
    if (fsView) {
      try {
        await updateFirestoreView(fsView.id, { visibility: 'private' });
        reloadFirestoreViews();
      } catch (err) {
        console.error('[SpaceTasks] demote view failed:', err);
      }
    }
  };

  // ─── Firestore view actions ────────────────────────────
  const handlePinView = async (viewId: string) => {
    const fsView = firestoreViews.find(v => v.id === viewId);
    if (!fsView) return;
    try {
      await pinView(viewId, !fsView.isPinned);
      reloadFirestoreViews();
    } catch (err) {
      console.error('[SpaceTasks] pin view failed:', err);
    }
  };

  const handleSetDefaultView = async (viewId: string) => {
    try {
      // Unset previous default
      const currentDefault = firestoreViews.find(v => v.isDefault);
      if (currentDefault) {
        await setDefaultView(currentDefault.id, false);
      }
      await setDefaultView(viewId, true);
      reloadFirestoreViews();
    } catch (err) {
      console.error('[SpaceTasks] set default view failed:', err);
    }
  };

  const handleShareViewLink = async (viewId: string) => {
    try {
      const token = await shareViewByLink(viewId);
      const url = `${window.location.origin}/shared-view/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success(t('views.linkCopied'));
      reloadFirestoreViews();
    } catch (err) {
      console.error('[SpaceTasks] share view link failed:', err);
    }
  };

  // ─── Preset change ─────────────────────────────────────
  const handlePresetChange = (id: string) => {
    setActivePreset(id);
    setActiveArtifactViewId(null); // Clear artifact view when switching to a task preset
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

  // ─── View autosave effect ────────────────────────────────
  // When the active preset is a saved/shared view, detect config changes and auto-save after 1500ms debounce.
  useEffect(() => {
    const isSavedView = activePreset.startsWith('saved:');
    const isSharedView = activePreset.startsWith('shared:');
    if (!isSavedView && !isSharedView) {
      lastSavedViewConfig.current = null;
      return;
    }
    // Don't auto-save shared views unless user has permission
    if (isSharedView && !canManageShared) return;
    // No snapshot yet means handleLoadView hasn't run
    if (!lastSavedViewConfig.current) return;

    const currentConfig = JSON.stringify({
      view, filters, sortBy, groupBy, density, columns, subtaskDisplay, calendarMode,
    });

    // No change — skip
    if (currentConfig === lastSavedViewConfig.current) return;

    // Clear previous timer
    if (viewAutoSaveTimer.current) clearTimeout(viewAutoSaveTimer.current);
    if (viewSavedFlashTimer.current) clearTimeout(viewSavedFlashTimer.current);

    viewAutoSaveTimer.current = setTimeout(async () => {
      const viewId = activePreset.replace(/^(saved:|shared:)/, '');
      setViewSaveStatus('saving');

      try {
        if (isSavedView && user?.uid) {
          // Update the saved view in the savedViews array
          const updatedViews = savedViews.map(sv =>
            sv.id === viewId
              ? { ...sv, view, filters, sortBy, groupBy, density, columns, subtaskDisplay, calendarMode }
              : sv
          );
          setSavedViews(updatedViews);
          await saveUserPreferences(user.uid, VIEWS_KEY, { views: updatedViews });
        } else if (isSharedView) {
          // Update the shared view in the sharedViews array
          const updatedViews = sharedViews.map(sv =>
            sv.id === viewId
              ? { ...sv, view, filters, sortBy, groupBy, density, columns, subtaskDisplay, calendarMode }
              : sv
          );
          setSharedViews(updatedViews);
          await saveSharedSpaceViews(spaceId, { views: updatedViews });
        }

        // Update snapshot to the new config
        lastSavedViewConfig.current = currentConfig;
        setViewSaveStatus('saved');

        // Flash "Saved" for 2 seconds then clear
        viewSavedFlashTimer.current = setTimeout(() => setViewSaveStatus(null), 2000);
      } catch (err) {
        console.error('[SpaceTasks] view autosave failed:', err);
        setViewSaveStatus(null);
      }
    }, 1500);

    return () => {
      if (viewAutoSaveTimer.current) clearTimeout(viewAutoSaveTimer.current);
    };
  }, [activePreset, view, filters, sortBy, groupBy, density, columns, subtaskDisplay, calendarMode, canManageShared, user?.uid, savedViews, sharedViews, spaceId, VIEWS_KEY]);

  const canCreate = can('task', 'create');

  // ─── Active artifact view (from Firestore views with artifactType) ──
  const activeArtifactView = useMemo(() => {
    if (!activeArtifactViewId) return null;
    return firestoreViews.find(v => v.id === activeArtifactViewId && v.artifactType) || null;
  }, [activeArtifactViewId, firestoreViews]);

  // ─── AddViewMenu handler ─────────────────────────
  const handleAddView = useCallback(async (viewType: string) => {
    const artifactTypes = ['dashboard', 'doc', 'form', 'whiteboard'];
    if (artifactTypes.includes(viewType)) {
      // Create artifact view in Firestore
      if (!user?.uid) return;
      try {
        const newViewId = await createFirestoreView({
          orgId: getCurrentOrgId(),
          scopeType: 'space',
          scopeId: spaceId,
          name: viewType.charAt(0).toUpperCase() + viewType.slice(1),
          viewType: 'artifact',
          artifactType: viewType as any,
          visibility: 'private',
          isDefault: false,
          isPinned: false,
          position: firestoreViews.length,
          config: {},
          sharedWith: [],
          createdBy: user.uid,
        });
        reloadFirestoreViews();
        setActiveArtifactViewId(newViewId);
      } catch (err) {
        console.error('[SpaceTasks] create artifact view failed:', err);
      }
    } else {
      // Task view type — switch to it
      handleViewChange(viewType as ViewType);
      setActiveArtifactViewId(null);
    }
  }, [user?.uid, spaceId, firestoreViews.length, reloadFirestoreViews, handleViewChange]);

  // ─── List access management ───────────────────────
  const handleSaveListAccess = async (visibility: 'inherited' | 'private', memberIds: string[]) => {
    if (!accessModalList?.id) return;
    await updateList(accessModalList.id, { visibility, members: memberIds });
    setSpaceLists(prev => prev.map(l =>
      l.id === accessModalList.id ? { ...l, visibility, members: memberIds } : l
    ));
    setAccessModalList(null);
  };

  // Helper: check if a list is private (for lock icon)
  const isPrivateList = (list: ListData) => list.visibility === 'private';

  // Resolve current list from listId prop
  const currentList = useMemo(() =>
    spaceLists.find(l => l.id === listId) || null,
    [spaceLists, listId]
  );

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
          firestoreViews={firestoreViews}
          onPinView={handlePinView}
          onSetDefaultView={canManageShared ? handleSetDefaultView : undefined}
          onShareViewLink={handleShareViewLink}
          viewSaveStatus={viewSaveStatus}
        />

        {/* Add View menu + artifact view tabs */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-subtle)]/40">
          {/* Artifact view tabs from Firestore views */}
          {firestoreViews.filter(v => v.artifactType).map(v => (
            <button
              key={v.id}
              onClick={() => setActiveArtifactViewId(activeArtifactViewId === v.id ? null : v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                activeArtifactViewId === v.id
                  ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {v.name}
            </button>
          ))}
          <AddViewMenu onSelect={handleAddView} />
        </div>

        {/* Private list indicator */}
        {granularPermsEnabled && currentList && isPrivateList(currentList) && (
          <div className="flex items-center gap-1 px-3 py-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded">
            <Lock className="w-3 h-3" />
            <span>Private list</span>
            <button onClick={() => setAccessModalList(currentList)} className="ml-2 underline hover:no-underline">
              Manage Access
            </button>
          </div>
        )}

        {/* View content */}
        <div className="flex-1 overflow-hidden relative">
          {activeArtifactView ? (
            <motion.div key={`artifact-${activeArtifactView.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full overflow-auto">
              <ArtifactViewRenderer
                artifactType={activeArtifactView.artifactType!}
                artifactId={activeArtifactView.artifactId}
                scopeType="space"
                scopeId={spaceId}
                tasks={tasks}
                goals={[]}
                members={members}
              />
            </motion.div>
          ) : emptyStateType ? (
            <TaskEmptyState
              type={emptyStateType}
              canCreate={canCreate}
              onCreateTask={() => setShowCreate(true)}
              onClearFilters={() => setFilters(EMPTY_FILTERS)}
            />
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
                      tasks={filteredTasks}
                      members={members}
                      teams={teams}
                      selectedTask={selectedTask}
                      canUpdate={can('task', 'update')}
                      onSelect={setSelectedTask}
                      onUpdate={doUpdate}
                      onStatusChange={(taskId, newStatus) => doUpdate(taskId, 'status', newStatus)}
                      onDelete={doDelete}
                      onQuickCreate={doCreate}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={field => {
                        if (sortBy === field) handleSortDirToggle();
                        else { handleSortByChange(field); setSortDir('asc'); persistPrefs({ lastSortDir: 'asc' }); }
                      }}
                      density={density}
                      columns={columns}
                      subtaskDisplay={subtaskDisplay}
                      calendarMode={calendarMode}
                      onModeChange={handleCalendarModeChange}
                      onDateChange={(taskId, newDate) => doUpdate(taskId, 'dueDate', newDate)}
                    />
                  </motion.div>
                );
              })()}
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

      {/* List access modal (granular permissions) */}
      {granularPermsEnabled && accessModalList && (
        <ListAccessModal
          list={accessModalList}
          members={members}
          onSave={handleSaveListAccess}
          onClose={() => setAccessModalList(null)}
          open={!!accessModalList}
        />
      )}
    </div>
  );
}
