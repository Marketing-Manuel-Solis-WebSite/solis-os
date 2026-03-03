'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { getTasks, createTask, updateTask, softDeleteTask, logAction, addTaskActivity, getMembers, getSettings, saveSettings } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare } from 'lucide-react';

import TaskSidebar from '@/components/tasks/task-sidebar';
import TaskToolbar from '@/components/tasks/task-toolbar';
import TaskListView from '@/components/tasks/task-list-view';
import TaskBoardView from '@/components/tasks/task-board-view';
import TaskCalendarView from '@/components/tasks/task-calendar-view';
import TaskDetailDrawer from '@/components/tasks/task-detail-drawer';
import TaskCreateModal from '@/components/tasks/task-create-modal';
import TaskBulkActions from '@/components/tasks/task-bulk-actions';
import { useToast } from '@/components/notifications/toast-provider';

import {
  Task, ViewType, FilterState, EMPTY_FILTERS, SavedView, TaskGroup,
  STATUSES, PRIORITIES, TASK_TYPES, PRIORITY_ORDER, SHORTCUTS,
} from '@/components/tasks/constants';

export default function TasksPage() {
  const { user, me, activeTeamId, teams, can, canSeeResource, allMembers, canSeeAllTeams } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  // Core data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [view, setView] = useState<ViewType>('list');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState('status');

  // Selection
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI
  const [showCreate, setShowCreate] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Load data
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
      const updated = tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  // Filtered + sorted tasks
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.archived);

    // Text search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some((tag: string) => tag.toLowerCase().includes(q))
      );
    }

    if (filters.status.length > 0) {
      result = result.filter(t => filters.status.includes(t.status));
    }
    if (filters.priority.length > 0) {
      result = result.filter(t => filters.priority.includes(t.priority));
    }
    if (filters.assignee.length > 0) {
      result = result.filter(t => t.assignees?.some((a: string) => filters.assignee.includes(a)));
    }
    if (filters.type.length > 0) {
      result = result.filter(t => filters.type.includes(t.type || 'task'));
    }
    if (filters.tags.length > 0) {
      result = result.filter(t => t.tags?.some((tag: string) => filters.tags.includes(tag)));
    }
    if (filters.dateRange.from) {
      const from = new Date(filters.dateRange.from);
      result = result.filter(t => { const d = t.dueDate?.toDate?.(); return d && d >= from; });
    }
    if (filters.dateRange.to) {
      const to = new Date(filters.dateRange.to);
      to.setHours(23, 59, 59);
      result = result.filter(t => { const d = t.dueDate?.toDate?.(); return d && d <= to; });
    }

    // Sort
    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'priority': return ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)) * dir;
        case 'due': return ((a.dueDate?.seconds || 9e9) - (b.dueDate?.seconds || 9e9)) * dir;
        case 'title': return (a.title || '').localeCompare(b.title || '') * dir;
        case 'status': {
          const so: Record<string, number> = {};
          STATUSES.forEach((s, i) => so[s.id] = i);
          return ((so[a.status] ?? 9) - (so[b.status] ?? 9)) * dir;
        }
        case 'points': return ((a.points || 0) - (b.points || 0)) * dir;
        default: return ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) * dir;
      }
    });

    return result;
  }, [tasks, filters, sortBy, sortDir]);

  // Groups
  const groups: TaskGroup[] = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: t('tasks.all'), tasks: filteredTasks, color: '#94A3B8', count: filteredTasks.length }];
    if (groupBy === 'status') return STATUSES.map(s => {
      const tk = filteredTasks.filter(x => x.status === s.id);
      return { key: s.id, label: t(`status.${s.id}`), tasks: tk, color: s.color, count: tk.length };
    });
    if (groupBy === 'priority') return PRIORITIES.map(p => {
      const tk = filteredTasks.filter(x => x.priority === p.id);
      return { key: p.id, label: t(`priority.${p.id}`), tasks: tk, color: p.color, count: tk.length };
    });
    if (groupBy === 'assignee') {
      const grouped: TaskGroup[] = members.map(m => {
        const tk = filteredTasks.filter(x => x.assignees?.includes(m.id));
        return { key: m.id, label: m.displayName || m.email, tasks: tk, color: '#3B82F6', count: tk.length };
      });
      const unassigned = filteredTasks.filter(x => !x.assignees?.length);
      if (unassigned.length > 0) grouped.push({ key: '__none__', label: t('tasks.unassigned'), tasks: unassigned, color: '#64748B', count: unassigned.length });
      return grouped;
    }
    return TASK_TYPES.map(tp => {
      const tk = filteredTasks.filter(x => (x.type || 'task') === tp.id);
      return { key: tp.id, label: t(`taskType.${tp.id}`), tasks: tk, color: tp.color, count: tk.length };
    });
  }, [filteredTasks, groupBy, members]);

  // Task counts
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.filter(t => !t.archived).length };
    STATUSES.forEach(s => { counts[s.id] = tasks.filter(t => t.status === s.id && !t.archived).length; });
    return counts;
  }, [tasks]);

  const doneCount = taskCounts.done || 0;

  // CRUD handlers
  const doCreate = async (data: any) => {
    if (!can('task', 'create')) return toast.warning(t('tasks.noPermission'), t('tasks.noPermCreate'));
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
    try { await addTaskActivity(id, { action: 'actualizó', field, from: String(old || ''), to: String(val), actorId: user!.uid, actorName: me!.displayName }); } catch {}
    if (field === 'assignees' && Array.isArray(val) && Array.isArray(old)) {
      const newAssignees = val.filter((uid: string) => !old.includes(uid) && uid !== user!.uid);
      const task = tasks.find(t => t.id === id);
      if (newAssignees.length > 0) {
        notifyMany(newAssignees, {
          type: 'task_assigned', title: t('tasks.assignedTo', { name: me!.displayName }),
          message: task?.title || t('tasks.updated'), entityType: 'task', entityId: id,
          entityUrl: '/app/tasks', actorId: user!.uid, actorName: me!.displayName,
        }).catch(() => {});
      }
    }
    load();
  };

  const doDelete = async (tk: any) => {
    if (!can('task', 'delete') && tk.createdBy !== user?.uid) return toast.warning(t('tasks.noPermission'), t('tasks.noPermDelete'));
    if (!confirm(t('tasks.deleteConfirm', { title: tk.title }))) return;
    await softDeleteTask(tk.id);
    await logAction({ action: 'deleted', resource: 'task', detail: tk.title, actorId: user!.uid, actorName: me!.displayName });
    if (selectedTask?.id === tk.id) setSelectedTask(null);
    load();
  };

  // Bulk actions
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

  // Saved views
  const handleSaveView = async () => {
    const name = prompt(t('tasks.viewName'));
    if (!name?.trim()) return;
    const sv: SavedView = {
      id: Date.now().toString(36),
      name: name.trim(),
      view, filters, sortBy, groupBy,
      createdBy: user!.uid,
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
  };

  // Keyboard shortcuts
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
        case SHORTCUTS.viewList: setView('list'); break;
        case SHORTCUTS.viewBoard: setView('board'); break;
        case SHORTCUTS.viewCalendar: setView('calendar'); break;
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

  const activeTeam = teams.find((t: any) => t.id === activeTeamId);
  const canCreate = can('task', 'create');

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <TaskSidebar
        open={sidebarOpen}
        view={view}
        filters={filters}
        groupBy={groupBy}
        sortBy={sortBy}
        members={members}
        taskCounts={taskCounts}
        savedViews={savedViews}
        onViewChange={setView}
        onFiltersChange={setFilters}
        onGroupByChange={setGroupBy}
        onSortByChange={setSortBy}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLoadView={handleLoadView}
        onSaveView={handleSaveView}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
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
          selectedCount={selectedIds.size}
          sidebarOpen={sidebarOpen}
          onViewChange={setView}
          onSearchChange={(s) => setFilters(f => ({ ...f, search: s }))}
          onFiltersChange={setFilters}
          onSortByChange={setSortBy}
          onSortDirToggle={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          onGroupByChange={setGroupBy}
          onNewTask={() => setShowCreate(true)}
          onClearFilters={() => setFilters(EMPTY_FILTERS)}
          onToggleSidebar={() => setSidebarOpen(true)}
        />

        {/* View content */}
        <div className="flex-1 overflow-hidden relative">
          {loading ? (
            <div className="px-6 py-3 space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <CheckSquare className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-base">{t('tasks.noTasks')}</p>
              {canCreate && (
                <button onClick={() => setShowCreate(true)} className="text-sm text-[var(--accent)] hover:underline mt-2">
                  {t('tasks.createFirst')}
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full">
                {view === 'list' && (
                  <TaskListView
                    groups={groups}
                    members={members}
                    teams={teams}
                    selectedTask={selectedTask}
                    selectedIds={selectedIds}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    canUpdate={can('task', 'update')}
                    onSelect={setSelectedTask}
                    onSelectionChange={setSelectedIds}
                    onUpdate={doUpdate}
                    onDelete={doDelete}
                    onSortChange={(field) => {
                      if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortBy(field); setSortDir('asc'); }
                    }}
                    onQuickCreate={doCreate}
                  />
                )}
                {view === 'board' && (
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
                )}
                {view === 'calendar' && (
                  <TaskCalendarView
                    tasks={filteredTasks}
                    members={members}
                    selectedTask={selectedTask}
                    onSelect={setSelectedTask}
                    onDateChange={(taskId, newDate) => doUpdate(taskId, 'dueDate', newDate)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Bulk Actions */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <TaskBulkActions
                count={selectedIds.size}
                onStatusChange={(status) => bulkUpdate('status', status)}
                onPriorityChange={(priority) => bulkUpdate('priority', priority)}
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
    </div>
  );
}
