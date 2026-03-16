'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Tag, Info } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useFeatureFlag } from '@/lib/feature-flags';
import { GOAL_STATUSES, GOAL_COLORS, GOAL_TYPES } from './constants';
import type { Goal, GoalStatus, GoalType } from './constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  editGoal?: Goal | null;
  /** Pre-set parent goal (for "Create child goal" action) */
  parentGoal?: Goal | null;
  /** All goals for parent selector */
  allGoals?: Goal[];
}

export default function GoalCreateModal({ open, onClose, onSave, editGoal, parentGoal, allGoals = [] }: Props) {
  const { t } = useI18n();
  const { me, teams, allMembers, activeTeamId } = useAuth();
  const okrEnabled = useFeatureFlag('okr-hierarchy');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<GoalStatus>('on_track');
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [teamId, setTeamId] = useState('');
  const [visibility, setVisibility] = useState('team');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [parentGoalId, setParentGoalId] = useState<string>('');
  const [goalType, setGoalType] = useState<GoalType>('goal');

  useEffect(() => {
    if (editGoal) {
      setName(editGoal.name);
      setDescription(editGoal.description || '');
      setOwnerId(editGoal.ownerId);
      setOwnerName(editGoal.ownerName);
      setDueDate(editGoal.dueDate || '');
      setStatus(editGoal.status);
      setColor(editGoal.color || GOAL_COLORS[0]);
      setTeamId(editGoal.teamId);
      setVisibility(editGoal.visibility || 'team');
      setTags(editGoal.tags || []);
      setParentGoalId(editGoal.parentGoalId || '');
      setGoalType(editGoal.goalType || 'goal');
    } else {
      setName('');
      setDescription('');
      setOwnerId(me?.userId || '');
      setOwnerName(me?.displayName || '');
      setDueDate('');
      setStatus('on_track');
      setColor(GOAL_COLORS[0]);
      setTeamId(activeTeamId === '__all__' ? '' : activeTeamId);
      setVisibility('team');
      setTags([]);
      setParentGoalId(parentGoal?.id || '');
      // Default to key_result when parent is an objective
      setGoalType(parentGoal?.goalType === 'objective' ? 'key_result' : 'goal');
    }
  }, [editGoal, open, me, activeTeamId, parentGoal]);

  const handleAddTag = () => {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    // When OKR is enabled and goalType is key_result, require a parent objective
    if (okrEnabled && goalType === 'key_result' && !parentGoalId) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      description: description.trim(),
      ownerId,
      ownerName,
      dueDate: dueDate || null,
      status,
      color,
      teamId,
      visibility,
      tags,
      parentGoalId: parentGoalId || null,
      ...(okrEnabled ? { goalType } : {}),
    });
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editGoal ? t('goals.editGoal') : t('goals.createGoal')}
            </h2>
            <button onClick={onClose} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Name */}
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.name')}</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('goals.namePlaceholder')}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.description')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('goals.descPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition resize-none"
              />
            </div>

            {/* Goal Type (OKR) */}
            {okrEnabled && (
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.goalType') || 'Goal Type'}</label>
                <div className="flex items-center gap-2">
                  {GOAL_TYPES.map(gt => (
                    <button
                      key={gt.value}
                      type="button"
                      onClick={() => setGoalType(gt.value)}
                      className={`flex-1 h-9 rounded-lg text-[13px] font-medium transition border ${
                        goalType === gt.value
                          ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {t(gt.labelKey) || gt.value.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                {goalType === 'objective' && (
                  <p className="flex items-center gap-1 mt-1.5 text-[12px] text-[var(--accent)]">
                    <Info className="h-3 w-3 shrink-0" />
                    {t('goals.objectiveHint') || 'Add Key Results after creating this objective'}
                  </p>
                )}
                {goalType === 'key_result' && !parentGoalId && (
                  <p className="flex items-center gap-1 mt-1.5 text-[12px] text-[var(--error)]">
                    <Info className="h-3 w-3 shrink-0" />
                    {t('goals.krRequiresParent') || 'Key Results must be linked to a parent Objective'}
                  </p>
                )}
              </div>
            )}

            {/* Row: Owner + Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.owner')}</label>
                <select
                  value={ownerId}
                  onChange={e => {
                    setOwnerId(e.target.value);
                    const m = allMembers.find(m => m.userId === e.target.value);
                    setOwnerName(m?.displayName || '');
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                >
                  <option value="">—</option>
                  {allMembers.filter(m => m.active !== false).map(m => (
                    <option key={m.userId} value={m.userId}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.dueDate')}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                />
              </div>
            </div>

            {/* Row: Status + Team */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.status')}</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as GoalStatus)}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                >
                  {GOAL_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.team')}</label>
                <select
                  value={teamId}
                  onChange={e => setTeamId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                >
                  <option value="">{t('common.general')}</option>
                  {teams.map(tm => (
                    <option key={tm.id} value={tm.id}>{tm.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parent Goal (cascading) */}
            {allGoals.length > 0 && (
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">
                  {okrEnabled && goalType === 'key_result'
                    ? (t('goals.parentObjective') || 'Parent Objective')
                    : (t('goals.parentGoal') || 'Parent Goal')}
                </label>
                <select
                  value={parentGoalId}
                  onChange={e => setParentGoalId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                >
                  <option value="">{t('goals.noParent') || 'None (top-level)'}</option>
                  {allGoals
                    .filter(g => g.id !== editGoal?.id) // can't be parent of itself
                    .filter(g => {
                      // When OKR is on and creating a KR, only show objectives as parents
                      if (okrEnabled && goalType === 'key_result') return g.goalType === 'objective';
                      return true;
                    })
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
              </div>
            )}

            {/* Color picker */}
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.color')}</label>
              <div className="flex items-center gap-2">
                {GOAL_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-[var(--accent)] scale-110' : 'hover:scale-110'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.tags')}</label>
              <div className="flex items-center gap-2 flex-wrap">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)]">
                    {tag}
                    <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-[var(--error)]">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder={t('goals.tagsPlaceholder')}
                    className="h-6 px-2 rounded-md bg-[var(--bg-base)] text-[12px] text-[var(--text-primary)] outline-none w-28"
                  />
                  <button onClick={handleAddTag} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--accent)]">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)]">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
