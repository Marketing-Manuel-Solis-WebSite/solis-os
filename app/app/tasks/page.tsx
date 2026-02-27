'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { getTasks, createTask, updateTask, softDeleteTask, logAction, addTaskActivity, getMembers } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import {
  Plus, Search, LayoutList, LayoutGrid, CheckSquare,
  ChevronDown, ChevronRight, Calendar, Filter,
} from 'lucide-react';
import { STATUSES, PRIORITIES, TASK_TYPES, PRIORITY_ORDER } from '@/components/tasks/constants';
import TaskDetailDrawer from '@/components/tasks/task-detail-drawer';
import TaskCreateModal from '@/components/tasks/task-create-modal';
import TaskBoardView from '@/components/tasks/task-board-view';

// === COLLAPSIBLE GROUP ===
function TaskGroup({ group, children }: { group: { key: string; label: string; color: string; count: number }; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 mb-2 group">
        {collapsed ? <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color, boxShadow: `0 0 8px ${group.color}40` }} />
        <span className="text-sm font-semibold text-[var(--text-secondary)]">{group.label}</span>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{group.count}</span>
      </button>
      {!collapsed && children}
    </div>
  );
}

// === MAIN ===
export default function TasksPage() {
  const { user, me, activeTeamId, teams, can, canSeeResource, allMembers, canSeeAllTeams } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('created');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const [groupBy, setGroupBy] = useState('status');

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([getTasks(activeTeamId), getMembers()]);
    const visible = (t as any[]).filter(task => !task.deleted && canSeeResource({
      teamId: task.teamId,
      createdBy: task.createdBy,
      visibility: task.visibility || 'team',
      assignees: task.assignees,
    }));
    setTasks(visible);
    setMembers(activeTeamId === '__all__' ? m : m.filter((x: any) => x.teamId === activeTeamId || x.teamIds?.includes(activeTeamId)));
    setLoading(false);
  }, [activeTeamId, canSeeResource]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => { if (sel) { const u = tasks.find(t => t.id === sel.id); if (u) setSel(u); } }, [tasks]);

  // Filter, sort, group
  let vis = tasks
    .filter(t => !t.archived)
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.tags?.some((tg: string) => tg.toLowerCase().includes(search.toLowerCase())));

  vis.sort((a: any, b: any) => {
    if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    if (sortBy === 'due') return (a.dueDate?.seconds || 9e9) - (b.dueDate?.seconds || 9e9);
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });

  const counts: Record<string, number> = { all: tasks.filter(t => !t.archived).length };
  STATUSES.forEach(s => { counts[s.id] = tasks.filter(t => t.status === s.id && !t.archived).length; });

  const groups = (() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'Todas', tasks: vis, color: '#94A3B8' }];
    if (groupBy === 'status') return STATUSES.map(s => ({ key: s.id, label: s.label, tasks: vis.filter(t => t.status === s.id), color: s.color }));
    if (groupBy === 'priority') return PRIORITIES.map(p => ({ key: p.id, label: p.label, tasks: vis.filter(t => t.priority === p.id), color: p.color }));
    return TASK_TYPES.map(tp => ({ key: tp.id, label: tp.label, tasks: vis.filter(t => (t.type || 'task') === tp.id), color: tp.color }));
  })();

  // Handlers
  const doCreate = async (data: any) => {
    if (!can('task', 'create')) return alert('Sin permisos para crear tareas');
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
        type: 'task_assigned',
        title: `${me!.displayName} te asignó una tarea`,
        message: data.title || 'Nueva tarea',
        entityType: 'task',
        entityId: taskRef.id,
        entityUrl: '/app/tasks',
        actorId: user!.uid,
        actorName: me!.displayName,
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
          type: 'task_assigned',
          title: `${me!.displayName} te asignó a una tarea`,
          message: task?.title || 'Tarea actualizada',
          entityType: 'task',
          entityId: id,
          entityUrl: '/app/tasks',
          actorId: user!.uid,
          actorName: me!.displayName,
        }).catch(() => {});
      }
    }
    load();
  };

  const doDelete = async (t: any) => {
    if (!can('task', 'delete') && t.createdBy !== user?.uid) return alert('Sin permisos para eliminar esta tarea');
    if (!confirm(`¿Eliminar "${t.title}"? Se moverá a la papelera.`)) return;
    await softDeleteTask(t.id);
    await logAction({ action: 'deleted', resource: 'task', detail: t.title, actorId: user!.uid, actorName: me!.displayName });
    if (sel?.id === t.id) setSel(null);
    load();
  };

  const activeTeam = teams.find(t => t.id === activeTeamId);
  const canCreate = can('task', 'create');

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                Tareas
                {activeTeam && (
                  <span className="text-sm font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${activeTeam.color}15`, color: activeTeam.color, border: `1px solid ${activeTeam.color}25` }}>
                    {activeTeam.icon} {activeTeam.name}
                  </span>
                )}
                {canSeeAllTeams && activeTeamId === '__all__' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 font-semibold">VISTA GENERAL</span>
                )}
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">{counts.all} tareas · {counts.done || 0} completadas</p>
            </div>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 h-10 rounded-xl btn-gold text-sm shadow-lg shadow-[#D4A843]/10">
                <Plus className="h-4 w-4" /> Nueva Tarea
              </button>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tareas..." className="input-dark pl-10 h-9 text-sm" />
            </div>
            <div className="flex rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 ${view === 'list' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                <LayoutList className="h-3.5 w-3.5" /> Lista
              </button>
              <button onClick={() => setView('board')} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 ${view === 'board' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Tablero
              </button>
            </div>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="select-dark h-9 text-xs">
              <option value="status">Grupo: Estado</option>
              <option value="priority">Grupo: Prioridad</option>
              <option value="type">Grupo: Tipo</option>
              <option value="none">Sin agrupar</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select-dark h-9 text-xs">
              <option value="created">Orden: Más recientes</option>
              <option value="priority">Orden: Prioridad</option>
              <option value="due">Orden: Fecha límite</option>
              <option value="title">Orden: A-Z</option>
            </select>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1.5 border-b border-[var(--border-subtle)] pb-0">
            {[{ id: 'all', label: 'Todas', color: '#94A3B8' }, ...STATUSES].map(s => (
              <button key={s.id} onClick={() => setFilter(s.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition ${filter === s.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'}`}
                style={filter === s.id ? { color: s.color, borderColor: s.color } : {}}>
                {s.label} <span className="ml-1 opacity-50">{counts[s.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
          ) : vis.length === 0 ? (
            <div className="text-center py-20">
              <CheckSquare className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">No se encontraron tareas.</p>
              {canCreate && <button onClick={() => setShowCreate(true)} className="text-sm text-[#D4A843] hover:underline mt-2">Crea tu primera tarea</button>}
            </div>
          ) : view === 'board' ? (
            <TaskBoardView groups={groups} teams={teams} members={members} selectedId={sel?.id || null} onSelect={setSel} />
          ) : (
            /* LIST VIEW */
            <div className="space-y-5">
              {groups.filter(g => g.tasks.length > 0).map(g => (
                <TaskGroup key={g.key} group={{ ...g, count: g.tasks.length }}>
                  <div className="space-y-1">
                    {g.tasks.map((t: any, i: number) => {
                      const st = STATUSES.find(s => s.id === t.status) || STATUSES[0];
                      const p = PRIORITIES.find(x => x.id === t.priority) || PRIORITIES[2];
                      const tp = TASK_TYPES.find(x => x.id === (t.type || 'task')) || TASK_TYPES[0];
                      const due = t.dueDate?.toDate?.();
                      const overdue = due && due < new Date() && t.status !== 'done';
                      const doneSub = (t.subtasks || []).filter((s: any) => s.done).length;
                      const totalSub = (t.subtasks || []).length;
                      const taskTeam = teams.find(tm => tm.id === t.teamId);

                      return (
                        <div key={t.id} onClick={() => setSel(t)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer group transition anim-slide ${sel?.id === t.id ? 'bg-[#D4A843]/5 border-[#D4A843]/20' : 'bg-[var(--bg-card)] border-[var(--border)]/50 hover:border-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover,#151D2E)]'}`}
                          style={{ animationDelay: `${i * 20}ms` }}>
                          {/* Status toggle */}
                          <button onClick={e => { e.stopPropagation(); doUpdate(t.id, 'status', t.status === 'done' ? 'todo' : 'done', t.status); }} className="shrink-0">
                            <st.Icon className="h-5 w-5" style={{ color: st.color }} />
                          </button>
                          {/* Type icon */}
                          <tp.Icon className="h-4 w-4 shrink-0 opacity-40" style={{ color: tp.color }} />
                          {/* Title + description */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${t.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{t.title}</p>
                            {t.description && <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{t.description}</p>}
                          </div>
                          {/* Team badge */}
                          {taskTeam && <span className="hidden xl:flex text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0" style={{ backgroundColor: `${taskTeam.color}15`, color: taskTeam.color }}>{taskTeam.icon} {taskTeam.name}</span>}
                          {/* Tags */}
                          {t.tags?.length > 0 && (
                            <div className="hidden lg:flex gap-1">
                              {t.tags.slice(0, 2).map((tg: string) => <span key={tg} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">{tg}</span>)}
                            </div>
                          )}
                          {/* Subtasks progress */}
                          {totalSub > 0 && <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]"><CheckSquare className="h-3 w-3" />{doneSub}/{totalSub}</div>}
                          {/* Due date */}
                          {due && (
                            <span className={`hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${overdue ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]'}`}>
                              <Calendar className="h-3 w-3" />{due.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {/* Priority */}
                          <span className="text-sm" title={p.label}>{p.icon}</span>
                          {/* Assignees */}
                          <div className="flex -space-x-1.5">
                            {t.assignees?.slice(0, 3).map((uid: string) => {
                              const m = members.find((x: any) => x.id === uid);
                              return <div key={uid} className="w-6 h-6 rounded-full bg-[#D4A843]/15 border-2 border-[var(--bg-base)] flex items-center justify-center text-[9px] font-bold text-[#D4A843]">{m?.displayName?.[0]?.toUpperCase() || '?'}</div>;
                            })}
                            {(t.assignees?.length || 0) > 3 && <div className="w-6 h-6 rounded-full bg-[var(--bg-elevated)] border-2 border-[var(--bg-base)] flex items-center justify-center text-[8px] text-[var(--text-muted)]">+{t.assignees.length - 3}</div>}
                          </div>
                          {/* Points */}
                          {t.points && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono">{t.points}pt</span>}
                        </div>
                      );
                    })}
                  </div>
                </TaskGroup>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {sel && (
        <TaskDetailDrawer
          task={sel}
          members={members}
          teams={teams}
          userId={user!.uid}
          userName={me!.displayName}
          canUpdate={can('task', 'update')}
          canDelete={can('task', 'delete')}
          onUpdate={doUpdate}
          onDelete={doDelete}
          onClose={() => setSel(null)}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <TaskCreateModal
          members={members}
          teams={teams}
          activeTeamId={activeTeamId}
          onClose={() => setShowCreate(false)}
          onCreate={doCreate}
        />
      )}
    </div>
  );
}
