'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Edit2, Trash2, Target, Calendar, User, ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import EntityRelations from '@/components/shared/entity-relations';
import { getGoalTargets, createGoalTarget, updateGoalTarget, deleteGoalTarget, recalculateGoalProgress, getTasks } from '@/lib/db';
import { GOAL_STATUSES, TARGET_TYPES, GOAL_COLORS } from './constants';
import type { Goal, GoalTarget, GoalStatus, TargetType } from './constants';
import TargetItem from './target-item';

interface Props {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export default function GoalDetailDrawer({ goal, open, onClose, onUpdate, onDelete, onRefresh }: Props) {
  const { t } = useI18n();
  const { me, user, allMembers, teams } = useAuth();
  const [targets, setTargets] = useState<GoalTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showAddTarget, setShowAddTarget] = useState(false);

  // Target form
  const [tName, setTName] = useState('');
  const [tType, setTType] = useState<TargetType>('number');
  const [tCurrent, setTCurrent] = useState(0);
  const [tTarget, setTTarget] = useState(100);
  const [tUnit, setTUnit] = useState('');
  const [tLinkedTasks, setTLinkedTasks] = useState<string[]>([]);
  const [tAutoSync, setTAutoSync] = useState(true);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);

  // Tasks for linking
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');

  useEffect(() => {
    if (goal && open) {
      loadTargets();
      loadTasks();
    }
  }, [goal?.id, open]);

  const loadTargets = async () => {
    if (!goal) return;
    setLoadingTargets(true);
    const ts = await getGoalTargets(goal.id);
    setTargets(ts as GoalTarget[]);
    setLoadingTargets(false);
  };

  const loadTasks = async () => {
    const { items: ts } = await getTasks();
    setAllTasks(ts);
  };

  const resetTargetForm = () => {
    setTName('');
    setTType('number');
    setTCurrent(0);
    setTTarget(100);
    setTUnit('');
    setTLinkedTasks([]);
    setTAutoSync(true);
    setEditingTargetId(null);
    setShowAddTarget(false);
  };

  const handleSaveTarget = async () => {
    if (!goal || !tName.trim()) return;
    setSavingTarget(true);
    if (editingTargetId) {
      await updateGoalTarget(goal.id, editingTargetId, {
        name: tName.trim(), type: tType, currentValue: tCurrent, targetValue: tTarget,
        unit: tUnit, linkedTaskIds: tLinkedTasks, autoSync: tAutoSync,
      });
    } else {
      await createGoalTarget(goal.id, {
        name: tName.trim(), type: tType, currentValue: tCurrent, targetValue: tTarget,
        unit: tUnit, linkedTaskIds: tLinkedTasks, autoSync: tAutoSync,
      });
    }
    await recalculateGoalProgress(goal.id);
    await loadTargets();
    onRefresh();
    resetTargetForm();
    setSavingTarget(false);
  };

  const handleEditTarget = (target: GoalTarget) => {
    setEditingTargetId(target.id);
    setTName(target.name);
    setTType(target.type);
    setTCurrent(target.currentValue);
    setTTarget(target.targetValue);
    setTUnit(target.unit);
    setTLinkedTasks(target.linkedTaskIds || []);
    setTAutoSync(target.autoSync);
    setShowAddTarget(true);
  };

  const handleDeleteTarget = async (targetId: string) => {
    if (!goal) return;
    await deleteGoalTarget(goal.id, targetId);
    await recalculateGoalProgress(goal.id);
    await loadTargets();
    onRefresh();
  };

  const filteredTasks = allTasks.filter(task => {
    if (taskSearch && !task.title?.toLowerCase().includes(taskSearch.toLowerCase())) return false;
    return true;
  }).slice(0, 20);

  if (!goal) return null;

  const statusInfo = GOAL_STATUSES.find(s => s.value === goal.status) || GOAL_STATUSES[0];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 h-full w-full max-w-[480px] z-50 bg-[var(--bg-elevated)] shadow-dropdown flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: goal.color }} />
                <h2 className="text-base font-semibold text-[var(--text-primary)] truncate">{goal.name}</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDelete(goal.id)}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={onClose} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Description */}
              {goal.description && (
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{goal.description}</p>
              )}

              {/* Meta row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--bg-base)]">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">{t('goals.status')}</p>
                  <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: statusInfo.color + '18', color: statusInfo.color }}>
                    {t(statusInfo.labelKey)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-base)]">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">{t('goals.progress')}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, background: goal.color }} />
                    </div>
                    <span className="text-[13px] font-bold" style={{ color: goal.color }}>{goal.progress}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {goal.ownerName && (
                  <div className="p-3 rounded-xl bg-[var(--bg-base)]">
                    <p className="text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">{t('goals.owner')}</p>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <span className="text-[13px] text-[var(--text-primary)] font-medium">{goal.ownerName}</span>
                    </div>
                  </div>
                )}
                {goal.dueDate && (
                  <div className="p-3 rounded-xl bg-[var(--bg-base)]">
                    <p className="text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">{t('goals.dueDate')}</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <span className="text-[13px] text-[var(--text-primary)]">{new Date(goal.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Targets section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('goals.targets')}</h3>
                  <button
                    onClick={() => { resetTargetForm(); setShowAddTarget(true); }}
                    className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:text-[var(--accent)] font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('goals.addTarget')}
                  </button>
                </div>

                {loadingTargets ? (
                  <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
                ) : targets.length === 0 ? (
                  <div className="text-center py-6 rounded-xl bg-[var(--bg-base)]">
                    <Target className="h-5 w-5 text-[var(--text-muted)]/30 mx-auto mb-2" />
                    <p className="text-[13px] text-[var(--text-muted)]">{t('goals.noTargets')}</p>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{t('goals.noTargetsDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {targets.map(target => (
                      <TargetItem
                        key={target.id}
                        target={target}
                        goalColor={goal.color}
                        onEdit={() => handleEditTarget(target)}
                        onDelete={() => handleDeleteTarget(target.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Add/Edit Target Form */}
                <AnimatePresence>
                  {showAddTarget && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <div className="p-4 rounded-xl bg-[var(--bg-base)] ring-1 ring-[var(--border-subtle)] space-y-3">
                        <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {editingTargetId ? t('goals.editTarget') : t('goals.addTarget')}
                        </h4>
                        <input
                          value={tName}
                          onChange={e => setTName(e.target.value)}
                          placeholder={t('goals.targetNamePlaceholder')}
                          className="w-full h-8 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                          autoFocus
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">{t('goals.targetType')}</label>
                            <select
                              value={tType}
                              onChange={e => setTType(e.target.value as TargetType)}
                              className="w-full h-8 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition text-[var(--text-primary)]"
                            >
                              {TARGET_TYPES.map(tt => (
                                <option key={tt.value} value={tt.value}>{t(tt.labelKey)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">{t('goals.currentValue')}</label>
                            <input
                              type="number"
                              value={tCurrent}
                              onChange={e => setTCurrent(Number(e.target.value))}
                              className="w-full h-8 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">{t('goals.targetValue')}</label>
                            <input
                              type="number"
                              value={tTarget}
                              onChange={e => setTTarget(Number(e.target.value))}
                              className="w-full h-8 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                            />
                          </div>
                        </div>

                        {tType !== 'percentage' && tType !== 'tasks' && (
                          <input
                            value={tUnit}
                            onChange={e => setTUnit(e.target.value)}
                            placeholder={t('goals.unit')}
                            className="w-full h-8 px-3 rounded-lg bg-[var(--bg-elevated)] text-[12px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                          />
                        )}

                        {tType === 'tasks' && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] text-[var(--text-muted)]">{t('goals.linkedTasks')} ({tLinkedTasks.length})</label>
                              <button onClick={() => setShowTaskPicker(!showTaskPicker)} className="text-[11px] text-[var(--accent)] hover:underline">
                                {t('goals.linkTasks')}
                              </button>
                            </div>
                            {showTaskPicker && (
                              <div className="max-h-32 overflow-y-auto rounded-lg bg-[var(--bg-elevated)] ring-1 ring-[var(--border-subtle)] p-1">
                                <input
                                  value={taskSearch}
                                  onChange={e => setTaskSearch(e.target.value)}
                                  placeholder={t('common.search')}
                                  className="w-full h-7 px-2 mb-1 rounded bg-[var(--bg-base)] text-[11px] text-[var(--text-primary)] outline-none"
                                />
                                {filteredTasks.map((task: any) => (
                                  <label key={task.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={tLinkedTasks.includes(task.id)}
                                      onChange={e => {
                                        if (e.target.checked) setTLinkedTasks([...tLinkedTasks, task.id]);
                                        else setTLinkedTasks(tLinkedTasks.filter(id => id !== task.id));
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-[11px] text-[var(--text-primary)] truncate">{task.title}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {tType === 'tasks' && (
                          <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                            <input type="checkbox" checked={tAutoSync} onChange={e => setTAutoSync(e.target.checked)} className="rounded" />
                            {t('goals.autoSync')}
                          </label>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button onClick={resetTargetForm} className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
                            {t('common.cancel')}
                          </button>
                          <button
                            onClick={handleSaveTarget}
                            disabled={!tName.trim() || savingTarget}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
                          >
                            {t('common.save')}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Related Items */}
              <div>
                <EntityRelations
                  entityType="goal"
                  entityId={goal.id}
                  entityName={goal.name || ''}
                />
              </div>

              {/* Tags */}
              {goal.tags?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t('goals.tags')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {goal.tags.map(tag => (
                      <span key={tag} className="text-[12px] px-2 py-1 rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)]">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
