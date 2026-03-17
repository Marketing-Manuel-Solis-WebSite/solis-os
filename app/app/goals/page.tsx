'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Target, Loader2, GitBranch, LayoutGrid, FileText, ArrowUpDown } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useFeatureFlag } from '@/lib/feature-flags';
import { getGoals, createGoal, updateGoal, deleteGoal, getChildGoals } from '@/lib/db';
import { afterGoalCreated, afterGoalUpdated, afterGoalDeleted } from '@/lib/goal-side-effects';
import GoalCard from '@/components/goals/goal-card';
import GoalCreateModal from '@/components/goals/goal-create-modal';
import GoalDetailDrawer from '@/components/goals/goal-detail-drawer';
import GoalFilters from '@/components/goals/goal-filters';
import GoalTemplatePicker from '@/components/goals/goal-template-picker';
import GoalTreeView from '@/components/goals/goal-tree-view';
import type { Goal, GoalStatus } from '@/components/goals/constants';

export default function GoalsPage() {
  const { user, me, activeTeamId, can } = useAuth();
  const { t, lang } = useI18n();
  const templatesEnabled = useFeatureFlag('goal-templates');
  const treeVizEnabled = useFeatureFlag('goal-tree-viz');

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoalStatus | ''>('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [menuGoal, setMenuGoal] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');
  const [showTemplates, setShowTemplates] = useState(false);
  const [parentGoalForCreate, setParentGoalForCreate] = useState<Goal | null>(null);
  const [childGoalsMap, setChildGoalsMap] = useState<Record<string, Goal[]>>({});
  const [sortGoalsBy, setSortGoalsBy] = useState('updatedAt');

  const loadGoals = useCallback(async () => {
    setLoading(true);
    const { items: data, hasMore: more } = await getGoals(activeTeamId === '__all__' ? undefined : activeTeamId);
    setGoals(data as Goal[]);
    setHasMore(more);
    setLoading(false);
  }, [activeTeamId]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  // Check overdue goals on load
  useEffect(() => {
    if (!user || !me || goals.length === 0) return;
    const now = new Date();
    goals.forEach(g => {
      if (g.dueDate && g.status !== 'completed' && g.status !== 'cancelled') {
        const due = new Date(g.dueDate);
        if (due < now && g.ownerId === user.uid) {
          // Goal is overdue — we could notify here, but we only flag it visually
        }
      }
    });
  }, [goals, user, me]);

  const handleCreate = async (data: any) => {
    const ref = await createGoal({
      ...data,
      createdBy: user?.uid || '',
      createdByName: me?.displayName || '',
    });
    await afterGoalCreated({
      goalId: ref.id,
      goal: data,
      actor: { actorId: user?.uid || '', actorName: me?.displayName || '' },
    });
    loadGoals();
  };

  const handleUpdate = async (id: string, data: any) => {
    await updateGoal(id, data);
    // Dispatch per changed field (name is the primary one with side effects)
    for (const field of Object.keys(data)) {
      await afterGoalUpdated({
        goalId: id,
        goal: data,
        field,
        from: undefined,
        to: data[field],
        actor: { actorId: user?.uid || '', actorName: me?.displayName || '' },
      });
    }
    loadGoals();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('goals.deleteConfirm'))) return;
    const goal = goals.find(g => g.id === id);
    await deleteGoal(id);
    await afterGoalDeleted({
      goalId: id,
      goal: goal || {},
      actor: { actorId: user?.uid || '', actorName: me?.displayName || '' },
    });
    setDetailGoal(null);
    loadGoals();
  };

  const handleEdit = (goal: Goal) => {
    setEditGoal(goal);
    setShowCreate(true);
    setMenuGoal(null);
  };

  const handleSaveEdit = async (data: any) => {
    if (editGoal) {
      await handleUpdate(editGoal.id, data);
      setEditGoal(null);
    } else {
      await handleCreate(data);
    }
    setParentGoalForCreate(null);
  };

  // Load child goals for a given goal (for detail drawer)
  const loadChildGoals = useCallback(async (goalId: string) => {
    const children = await getChildGoals(goalId);
    setChildGoalsMap(prev => ({ ...prev, [goalId]: children as Goal[] }));
  }, []);

  // Filtered and sorted goals
  const filtered = goals.filter(g => {
    if (search) {
      const s = search.toLowerCase();
      if (!g.name?.toLowerCase().includes(s) && !g.description?.toLowerCase().includes(s)) return false;
    }
    if (statusFilter && g.status !== statusFilter) return false;
    if (ownerFilter && g.ownerId !== ownerFilter) return false;
    return true;
  }).sort((a: any, b: any) => {
    if (sortGoalsBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortGoalsBy === 'progress') return (b.progress || 0) - (a.progress || 0);
    if (sortGoalsBy === 'dueDate') {
      const da = a.dueDate?.seconds || Infinity;
      const db = b.dueDate?.seconds || Infinity;
      return da - db;
    }
    const ta = a[sortGoalsBy]?.seconds || 0;
    const tb = b[sortGoalsBy]?.seconds || 0;
    return tb - ta;
  });

  // Tree view: top-level goals (no parent) and their children
  const topLevel = filtered.filter(g => !g.parentGoalId);
  const childrenOf = (parentId: string) => filtered.filter(g => g.parentGoalId === parentId);

  return (
    <div className="p-6 max-w-7xl mx-auto" onClick={() => setMenuGoal(null)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Target className="h-6 w-6 text-[var(--accent)]" />
            {t('goals.title')}
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-0.5">{t('goals.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort */}
          <select
            value={sortGoalsBy}
            onChange={e => setSortGoalsBy(e.target.value)}
            className="input-dark h-9 text-[13px] pr-8"
          >
            <option value="updatedAt">{lang === 'es' ? 'Reciente' : 'Recent'}</option>
            <option value="name">{lang === 'es' ? 'Nombre' : 'Name'}</option>
            <option value="progress">{lang === 'es' ? 'Progreso' : 'Progress'}</option>
            <option value="dueDate">{lang === 'es' ? 'Fecha limite' : 'Due date'}</option>
            <option value="createdAt">{lang === 'es' ? 'Creado' : 'Created'}</option>
          </select>

          {/* View toggle */}
          <div className="flex rounded-lg bg-[var(--bg-tertiary)] overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 transition ${viewMode === 'grid' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              title={t('goals.gridView') || 'Grid view'}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-2.5 py-1.5 transition ${viewMode === 'tree' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              title={t('goals.treeView') || 'Tree view'}
            >
              <GitBranch className="h-4 w-4" />
            </button>
          </div>

          {can('goal', 'create') && (
            <div className="flex items-center gap-2">
              {templatesEnabled && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm font-medium shadow-card hover:bg-[var(--bg-hover)] transition border border-[var(--border-subtle)]"
                >
                  <FileText className="h-4 w-4" /> {lang === 'es' ? 'Plantilla' : 'Template'}
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setEditGoal(null); setParentGoalForCreate(null); setShowCreate(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-md hover:opacity-90 transition"
              >
                <Plus className="h-4 w-4" /> {t('goals.createGoal')}
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5">
        <GoalFilters
          search={search} onSearch={setSearch}
          statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          ownerFilter={ownerFilter} onOwnerFilter={setOwnerFilter}
        />
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Target className="h-10 w-10 text-[var(--text-muted)]/20 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t('goals.noGoals')}</h3>
          <p className="text-[14px] text-[var(--text-muted)] mb-4">{t('goals.noGoalsDesc')}</p>
          {can('goal', 'create') && (
            <button onClick={() => { setEditGoal(null); setShowCreate(true); }} className="text-[var(--accent)] text-sm font-medium hover:underline">
              {t('goals.createGoal')}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ─── Grid View ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((goal, i) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <GoalCard
                goal={goal}
                onClick={() => { setDetailGoal(goal); loadChildGoals(goal.id); }}
                onMenu={e => {
                  e.stopPropagation();
                  setMenuGoal(menuGoal === goal.id ? null : goal.id);
                }}
              />
              {/* Context menu */}
              <AnimatePresence>
                {menuGoal === goal.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute z-20 w-36 py-1 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown mt-1"
                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button onClick={() => handleEdit(goal)} className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg mx-auto">
                      {t('goals.editGoal')}
                    </button>
                    <button onClick={() => { handleDelete(goal.id); setMenuGoal(null); }} className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/5 rounded-lg mx-auto">
                      {t('goals.deleteGoal')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      ) : treeVizEnabled ? (
        /* ─── Enhanced Tree View (GoalTreeView with SVG lines) ─── */
        <GoalTreeView
          goals={filtered}
          onSelectGoal={(goal) => { setDetailGoal(goal); loadChildGoals(goal.id); }}
        />
      ) : (
        /* ─── Fallback Tree View (hierarchical list) ─── */
        <div className="space-y-2">
          {topLevel.map((goal, i) => {
            const children = childrenOf(goal.id);
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                {/* Parent goal row */}
                <div
                  onClick={() => { setDetailGoal(goal); loadChildGoals(goal.id); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] cursor-pointer transition group"
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: goal.color || '#7B68EE' }} />
                  <span className="text-[14px] font-semibold text-[var(--text-primary)] flex-1 truncate">{goal.name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    goal.status === 'on_track' ? 'bg-emerald-500/10 text-emerald-400' :
                    goal.status === 'at_risk' ? 'bg-amber-500/10 text-amber-400' :
                    goal.status === 'behind' ? 'bg-red-500/10 text-red-400' :
                    goal.status === 'completed' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>
                    {t(`goals.status${goal.status.charAt(0).toUpperCase() + goal.status.slice(1).replace(/_./g, m => m[1].toUpperCase())}`) || goal.status}
                  </span>
                  <div className="flex items-center gap-2 w-24">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, background: goal.color || '#7B68EE' }} />
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] w-7 text-right">{goal.progress}%</span>
                  </div>
                  {children.length > 0 && (
                    <span className="text-[11px] text-[var(--text-muted)] ml-1">{children.length} sub</span>
                  )}
                </div>

                {/* Child goals (indented) */}
                {children.length > 0 && (
                  <div className="ml-6 mt-1 space-y-1 border-l-2 border-[var(--border-subtle)] pl-3">
                    {children.map(child => {
                      const grandchildren = childrenOf(child.id);
                      return (
                        <div key={child.id}>
                          <div
                            onClick={() => { setDetailGoal(child); loadChildGoals(child.id); }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer transition"
                          >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: child.color || '#7B68EE' }} />
                            <span className="text-[13px] text-[var(--text-secondary)] flex-1 truncate">{child.name}</span>
                            <div className="flex items-center gap-1.5 w-20">
                              <div className="flex-1 h-1 rounded-full bg-[var(--bg-base)] overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${child.progress}%`, background: child.color || '#7B68EE' }} />
                              </div>
                              <span className="text-[11px] text-[var(--text-muted)] w-7 text-right">{child.progress}%</span>
                            </div>
                          </div>
                          {/* Grandchildren (3rd level) */}
                          {grandchildren.length > 0 && (
                            <div className="ml-5 mt-0.5 space-y-0.5 border-l border-[var(--border-subtle)] pl-2.5">
                              {grandchildren.map(gc => (
                                <div
                                  key={gc.id}
                                  onClick={() => { setDetailGoal(gc); loadChildGoals(gc.id); }}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] cursor-pointer transition"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: gc.color || '#7B68EE' }} />
                                  <span className="text-[12px] text-[var(--text-muted)] flex-1 truncate">{gc.name}</span>
                                  <span className="text-[10px] text-[var(--text-muted)]">{gc.progress}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Has More indicator */}
      {hasMore && !loading && (
        <div className="text-center py-4 mt-2">
          <span className="text-[13px] text-[var(--text-muted)]">
            {t('common.showingItems', { n: goals.length })} — {t('common.moreAvailable')}
          </span>
        </div>
      )}

      {/* Create/Edit Modal */}
      <GoalCreateModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditGoal(null); setParentGoalForCreate(null); }}
        onSave={handleSaveEdit}
        editGoal={editGoal}
        parentGoal={parentGoalForCreate}
        allGoals={goals}
      />

      {/* Template Picker */}
      {templatesEnabled && (
        <GoalTemplatePicker
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
          onCreated={loadGoals}
        />
      )}

      {/* Detail Drawer */}
      <GoalDetailDrawer
        goal={detailGoal}
        open={!!detailGoal}
        onClose={() => setDetailGoal(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onRefresh={loadGoals}
        childGoals={detailGoal ? (childGoalsMap[detailGoal.id] || []) : []}
        onCreateChild={(parent) => {
          setParentGoalForCreate(parent);
          setEditGoal(null);
          setShowCreate(true);
        }}
      />
    </div>
  );
}
