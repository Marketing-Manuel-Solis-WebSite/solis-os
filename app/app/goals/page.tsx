'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Target, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getGoals, createGoal, updateGoal, deleteGoal } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import GoalCard from '@/components/goals/goal-card';
import GoalCreateModal from '@/components/goals/goal-create-modal';
import GoalDetailDrawer from '@/components/goals/goal-detail-drawer';
import GoalFilters from '@/components/goals/goal-filters';
import type { Goal, GoalStatus } from '@/components/goals/constants';

export default function GoalsPage() {
  const { user, me, activeTeamId, can } = useAuth();
  const { t } = useI18n();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoalStatus | ''>('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [menuGoal, setMenuGoal] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    const data = await getGoals(activeTeamId === '__all__' ? undefined : activeTeamId);
    setGoals(data as Goal[]);
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

    // Notify owner if different from creator
    if (data.ownerId && data.ownerId !== user?.uid) {
      notifyMany([data.ownerId], {
        type: 'goal_assigned',
        title: t('goals.assignedToYou'),
        message: data.name,
        entityUrl: '/app/goals',
        actorId: user?.uid || '',
        actorName: me?.displayName || '',
      });
    }
    loadGoals();
  };

  const handleUpdate = async (id: string, data: any) => {
    await updateGoal(id, data);
    loadGoals();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('goals.deleteConfirm'))) return;
    await deleteGoal(id);
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
  };

  // Filtered goals
  const filtered = goals.filter(g => {
    if (search) {
      const s = search.toLowerCase();
      if (!g.name?.toLowerCase().includes(s) && !g.description?.toLowerCase().includes(s)) return false;
    }
    if (statusFilter && g.status !== statusFilter) return false;
    if (ownerFilter && g.ownerId !== ownerFilter) return false;
    return true;
  });

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
        {can('goal', 'create') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setEditGoal(null); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-md hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" /> {t('goals.createGoal')}
          </motion.button>
        )}
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
      ) : (
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
                onClick={() => setDetailGoal(goal)}
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
      )}

      {/* Create/Edit Modal */}
      <GoalCreateModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditGoal(null); }}
        onSave={handleSaveEdit}
        editGoal={editGoal}
      />

      {/* Detail Drawer */}
      <GoalDetailDrawer
        goal={detailGoal}
        open={!!detailGoal}
        onClose={() => setDetailGoal(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onRefresh={loadGoals}
      />
    </div>
  );
}
