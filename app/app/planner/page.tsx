'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { getTasks, createTask, updateTask, softDeleteTask, logAction, addTaskActivity, getMembers } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

import PlannerToolbar, { type PlannerView } from '@/components/planner/planner-toolbar';
import PlannerCalendar from '@/components/planner/planner-calendar';
import PlannerTimeline from '@/components/planner/planner-timeline';
import PlannerWorkload from '@/components/planner/planner-workload';
import TaskDetailDrawer from '@/components/tasks/task-detail-drawer';
import TaskCreateModal from '@/components/tasks/task-create-modal';
import { useToast } from '@/components/notifications/toast-provider';

import {
  Task, FilterState, EMPTY_FILTERS, STATUSES, PRIORITIES, PRIORITY_ORDER,
} from '@/components/tasks/constants';

export default function PlannerPage() {
  const { user, me, activeTeamId, teams, can, canSeeResource, allMembers, canSeeAllTeams } = useAuth();
  const toast = useToast();
  const { t } = useI18n();

  // Core data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  // View state
  const [view, setView] = useState<PlannerView>('calendar');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Selection
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // UI
  const [showCreate, setShowCreate] = useState(false);

  // Load data
  const load = useCallback(async () => {
    const [{ items: tasksData, hasMore: more }, m] = await Promise.all([getTasks(activeTeamId), getMembers()]);
    const visible = (tasksData as any[]).filter(task => !task.deleted && canSeeResource({
      teamId: task.teamId,
      createdBy: task.createdBy,
      visibility: task.visibility || 'team',
      assignees: task.assignees,
    }));
    setTasks(visible as Task[]);
    setHasMore(more);
    setMembers(activeTeamId === '__all__' ? m : m.filter((x: any) => x.teamId === activeTeamId || x.teamIds?.includes(activeTeamId)));
    setLoading(false);
  }, [activeTeamId, canSeeResource]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Sync selected task with updated data
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.archived);

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

    return result;
  }, [tasks, filters]);

  // Count tasks with dates (for toolbar display)
  const datedCount = filteredTasks.filter(t => t.dueDate || t.startDate).length;

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
        entityUrl: '/app/planner', actorId: user!.uid, actorName: me!.displayName,
      }).catch((err) => console.error('[Planner] notify task assigned failed:', err));
    }
    setShowCreate(false);
    load();
  };

  const doUpdate = async (id: string, field: string, val: any, old?: any) => {
    if (!can('task', 'update')) return;
    await updateTask(id, { [field]: val });
    try { await addTaskActivity(id, { action: t('planner.activityUpdated'), field, from: String(old || ''), to: String(val), actorId: user!.uid, actorName: me!.displayName }); } catch (err) { console.error('[Planner] add task activity failed:', err); }
    if (field === 'assignees' && Array.isArray(val) && Array.isArray(old)) {
      const newAssignees = val.filter((uid: string) => !old.includes(uid) && uid !== user!.uid);
      const task = tasks.find(t => t.id === id);
      if (newAssignees.length > 0) {
        notifyMany(newAssignees, {
          type: 'task_assigned', title: t('tasks.assignedTo', { name: me!.displayName }),
          message: task?.title || t('tasks.updated'), entityType: 'task', entityId: id,
          entityUrl: '/app/planner', actorId: user!.uid, actorName: me!.displayName,
        }).catch((err) => console.error('[Planner] notify task reassigned failed:', err));
      }
    }
    load();
  };

  const doDelete = async (task: any) => {
    if (!can('task', 'delete') && task.createdBy !== user?.uid) return toast.warning(t('tasks.noPermission'), t('tasks.noPermDelete'));
    if (!confirm(t('tasks.deleteConfirm', { title: task.title }))) return;
    await softDeleteTask(task.id);
    await logAction({ action: 'deleted', resource: 'task', detail: task.title, actorId: user!.uid, actorName: me!.displayName });
    if (selectedTask?.id === task.id) setSelectedTask(null);
    load();
  };

  const activeTeam = teams.find((t: any) => t.id === activeTeamId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Toolbar */}
      <PlannerToolbar
        view={view}
        filters={filters}
        taskCount={datedCount}
        canCreate={can('task', 'create')}
        activeTeam={activeTeam}
        canSeeAllTeams={canSeeAllTeams}
        activeTeamId={activeTeamId}
        onViewChange={setView}
        onFiltersChange={setFilters}
        onNewTask={() => setShowCreate(true)}
      />

      {/* View content */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="px-6 py-3 space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full">
              {view === 'calendar' && (
                <PlannerCalendar
                  tasks={filteredTasks}
                  members={members}
                  teams={teams}
                  selectedTask={selectedTask}
                  onSelect={setSelectedTask}
                  onDateChange={(taskId, newDate) => doUpdate(taskId, 'dueDate', newDate)}
                />
              )}
              {view === 'timeline' && (
                <PlannerTimeline
                  tasks={filteredTasks}
                  members={members}
                  selectedTask={selectedTask}
                  onSelect={setSelectedTask}
                  onDateRangeChange={(taskId, startDate, endDate) => {
                    updateTask(taskId, { startDate, dueDate: endDate }).then(load);
                  }}
                />
              )}
              {view === 'workload' && (
                <PlannerWorkload
                  tasks={filteredTasks}
                  members={members}
                  selectedTask={selectedTask}
                  onSelect={setSelectedTask}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Has More indicator */}
      {hasMore && !loading && (
        <div className="px-6 py-2 text-center border-t border-[var(--border-primary)]">
          <span className="text-[13px] text-[var(--text-muted)]">
            {t('common.showingItems', { n: tasks.length })} — {t('common.moreAvailable')}
          </span>
        </div>
      )}

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
