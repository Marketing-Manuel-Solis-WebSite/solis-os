'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, CheckSquare, Plus, ChevronDown, Zap, LayoutTemplate } from 'lucide-react';
import { useFeatureFlag } from '@/lib/feature-flags';
import TaskTemplatePicker from '@/components/templates/task-template-picker';
import {
  STATUSES, PRIORITIES, TASK_TYPES, VISIBILITY,
} from './constants';
import RecurrencePicker from './recurrence-picker';
import type { RecurrenceConfig } from '@/lib/recurrence';
import { useCustomFieldDefs } from '@/lib/hooks/use-custom-field-defs';
import { getFieldsByGroup } from '@/lib/custom-fields';
import CustomFieldRenderer from './custom-field-renderer';
import { validateCustomFieldValues } from '@/lib/validation';

interface Props {
  members: any[];
  teams: any[];
  activeTeamId: string;
  lists?: { id?: string; name: string }[];
  defaultListId?: string | null;
  onClose: () => void;
  onCreate: (data: any) => void;
}

export default function TaskCreateModal({ members, teams, activeTeamId, lists, defaultListId, onClose, onCreate }: Props) {
  const { t, lang } = useI18n();
  const { activeFields, groups, loading: fieldsLoading } = useCustomFieldDefs();
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const templatesFlagEnabled = useFeatureFlag('task-templates');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [d, setD] = useState({
    title: '', description: '', status: 'todo', priority: 'medium', type: 'task',
    assignees: [] as string[], tags: [] as string[], dueDate: '', startDate: '', timeEstimate: '',
    points: '', subtasks: [] as any[], visibility: 'team',
    teamId: activeTeamId === '__all__' ? '' : activeTeamId,
    listId: defaultListId || '' as string,
    customFields: {} as Record<string, any>,
    recurrence: undefined as RecurrenceConfig | undefined,
  });
  const [tagInput, setTagInput] = useState('');
  const [newSub, setNewSub] = useState('');
  const [showFields, setShowFields] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['legal']));

  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }));
  const toggleAssignee = (id: string) =>
    set('assignees', d.assignees.includes(id) ? d.assignees.filter((x: string) => x !== id) : [...d.assignees, id]);
  const addSub = () => {
    if (!newSub.trim()) return;
    set('subtasks', [...d.subtasks, { id: Date.now().toString(), title: newSub.trim(), done: false }]);
    setNewSub('');
  };
  const setCustomField = (fid: string, val: any) => set('customFields', { ...d.customFields, [fid]: val });
  const removeCustomField = (fid: string) => {
    const u = { ...d.customFields };
    delete u[fid];
    set('customFields', u);
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,/g, '');
    if (tag && !d.tags.includes(tag)) {
      set('tags', [...d.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    set('tags', d.tags.filter((t: string) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && d.tags.length > 0) {
      set('tags', d.tags.slice(0, -1));
    }
  };

  // Required fields check
  const requiredFields = activeFields.filter(f => f.required);
  const missingRequired = requiredFields.filter(f => {
    const val = d.customFields[f.id];
    if (val === undefined || val === null || val === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });
  const hasRequiredMissing = missingRequired.length > 0;

  const submit = () => {
    if (!d.title.trim()) return;
    if (hasRequiredMissing) return; // Block submit if required fields missing
    // Flush any pending tag input
    if (tagInput.trim()) {
      d.tags = [...d.tags, tagInput.trim()];
      setTagInput('');
    }
    // Validate & sanitize custom fields before creating
    const { sanitized: cleanCustomFields } = validateCustomFieldValues(d.customFields, activeFields);
    const out: any = {
      ...d,
      customFields: cleanCustomFields,
      tags: d.tags,
      points: d.points ? Number(d.points) : null,
      timeEstimate: d.timeEstimate ? Number(d.timeEstimate) : null,
    };
    if (d.dueDate) out.dueDate = new Date(d.dueDate);
    if (d.startDate) out.startDate = new Date(d.startDate);
    if (d.recurrence) out.recurrence = d.recurrence;
    onCreate(out);
  };

  const toggleGroup = (gid: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  const activeFieldIds = Object.keys(d.customFields);
  const fieldsByGroup = getFieldsByGroup(activeFields);

  const sectionSep = (label: string) => (
    <div className="relative py-5">
      <div className="h-px bg-[var(--border-subtle)]" />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 px-2 bg-[var(--bg-base)] text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold">
        {label}
      </span>
    </div>
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && d.title.trim() && !hasRequiredMissing) {
      e.preventDefault();
      submit();
    }
  };

  const renderDynamicFieldInput = (fieldDef: typeof activeFields[number]) => {
    const val = d.customFields[fieldDef.id];
    const label = lang === 'es' ? fieldDef.nameEs : fieldDef.name;
    const isMissing = fieldDef.required && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0));

    return (
      <div key={fieldDef.id} className="flex items-center gap-2 mb-2">
        <label className={`text-sm w-36 shrink-0 ${isMissing ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
          {label}{fieldDef.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <div className="flex-1">
          <CustomFieldRenderer
            field={fieldDef}
            value={val}
            onChange={(v) => setCustomField(fieldDef.id, v)}
            members={members}
          />
        </div>
        <button
          onClick={() => removeCustomField(fieldDef.id)}
          className="text-[var(--text-muted)] hover:text-red-400 p-1 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  // ───────────────────────────────────────────
  // QUICK MODE
  // ───────────────────────────────────────────
  const quickContent = (
    <motion.div
      key="quick"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-[560px] bg-[var(--bg-base)] rounded-2xl shadow-modal"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-[17px] font-bold text-[var(--text-primary)]">{t('taskCreate.title')}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {templatesFlagEnabled && (
            <button
              onClick={() => setTemplatePickerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 transition"
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              {lang === 'es' ? 'Desde Plantilla' : 'From Template'}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Template Picker */}
      {templatesFlagEnabled && (
        <TaskTemplatePicker
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          onApply={(taskData) => { onCreate(taskData); onClose(); }}
          teamId={activeTeamId}
          spaceId={activeTeamId}
          listId={defaultListId || ''}
        />
      )}

      <div className="px-6 pb-6 space-y-3">
        {/* Title */}
        <input
          value={d.title}
          onChange={(e) => set('title', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('taskCreate.titlePlaceholder')}
          autoFocus
          className="w-full h-14 px-5 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[18px] font-semibold placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
        />

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-semibold">
              {t('taskCreate.status')}
            </label>
            <select
              value={d.status}
              onChange={(e) => set('status', e.target.value)}
              className="select-dark w-full h-10 rounded-xl text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{t(`status.${s.id}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-semibold">
              {t('taskCreate.priority')}
            </label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set('priority', p.id)}
                  title={t(`priority.${p.id}`)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all duration-200 ${
                    d.priority === p.id
                      ? 'ring-2 ring-white/20 scale-110'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {p.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Assignees compact */}
        {members.length > 0 && (
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-semibold">
              {t('taskCreate.assignees')}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {members.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => toggleAssignee(m.id)}
                  className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                    d.assignees.includes(m.id)
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/20'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[9px] font-bold">
                    {m.displayName?.[0]?.toUpperCase()}
                  </div>
                  {m.displayName}
                  {d.assignees.includes(m.id) && <Check className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Due Date + Team */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-semibold">
              {t('taskCreate.dueDate')}
            </label>
            <input
              type="date"
              value={d.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className="input-dark h-10 rounded-xl text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-semibold">
              {t('taskCreate.department')}
            </label>
            <select
              value={d.teamId}
              onChange={(e) => set('teamId', e.target.value)}
              className="select-dark w-full h-10 rounded-xl text-sm"
            >
              <option value="">{t('common.general')}</option>
              {teams.map((tm: any) => (
                <option key={tm.id} value={tm.id}>{tm.icon} {tm.name}</option>
              ))}
            </select>
          </div>
          {/* List selector (quick mode) */}
          {lists && lists.length > 0 && (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-semibold">
                {t('spaces.lists')}
              </label>
              <select
                value={d.listId}
                onChange={(e) => set('listId', e.target.value)}
                className="select-dark w-full h-10 rounded-xl text-sm"
              >
                <option value="">{t('spaces.unsorted')}</option>
                {lists.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tags (quick mode) */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-semibold">
            {t('taskCreate.tags')}
          </label>
          <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-transparent focus-within:border-[var(--accent)]/30 transition">
            {d.tags.map((tag: string) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] text-[12px] font-medium"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-[var(--error)] transition">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
              placeholder={d.tags.length === 0 ? t('taskCreate.tagsPlaceholder') : ''}
              className="flex-1 min-w-[60px] h-6 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setMode('full')}
            className="text-[13px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('tasks.moreOptions')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-10 px-5 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={submit}
              disabled={!d.title.trim()}
              className="h-10 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-semibold transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('common.create')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ───────────────────────────────────────────
  // FULL MODE
  // ───────────────────────────────────────────
  const fullContent = (
    <motion.div
      key="full"
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 10 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-[780px] max-h-[90vh] overflow-y-auto bg-[var(--bg-base)] rounded-2xl shadow-modal"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-7 py-5 bg-[var(--bg-base)] border-b border-[var(--border-subtle)] rounded-t-2xl">
        <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{t('taskCreate.title')}</h2>
        <button
          onClick={onClose}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-7 pb-7">
        {/* ──────── Section 1: Identidad ──────── */}
        {sectionSep(t('taskCreate.sectionIdentity'))}

        <div className="space-y-3">
          {/* Title */}
          <input
            value={d.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t('taskCreate.titlePlaceholder')}
            autoFocus
            className="w-full h-14 px-4 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[18px] font-semibold placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
          />

          {/* Description */}
          <textarea
            value={d.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={t('taskCreate.descPlaceholder')}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[14px] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 resize-y"
          />

          {/* Type */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
              {t('taskCreate.type')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map((tp) => (
                <button
                  key={tp.id}
                  onClick={() => set('type', tp.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all duration-200 border ${
                    d.type === tp.id
                      ? ''
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
                  }`}
                  style={
                    d.type === tp.id
                      ? { backgroundColor: `${tp.color}15`, borderColor: `${tp.color}30`, color: tp.color }
                      : {}
                  }
                >
                  <tp.Icon className="h-3.5 w-3.5" />
                  {t(`taskType.${tp.id}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ──────── Section 2: Organizacion ──────── */}
        {sectionSep(t('taskCreate.sectionOrganization'))}

        <div className="space-y-3">
          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.status')}
              </label>
              <select
                value={d.status}
                onChange={(e) => set('status', e.target.value)}
                className="select-dark w-full h-10 text-[14px] rounded-xl"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{t(`status.${s.id}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.priority')}
              </label>
              <div className="flex gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => set('priority', p.id)}
                    title={t(`priority.${p.id}`)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all duration-200 ${
                      d.priority === p.id
                        ? 'ring-2 ring-white/20 scale-110'
                        : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
              {t('taskCreate.visibility')}
            </label>
            <div className="flex gap-1.5">
              {VISIBILITY.map((v) => (
                <button
                  key={v.id}
                  onClick={() => set('visibility', v.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border ${
                    d.visibility === v.id
                      ? ''
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-transparent hover:bg-[var(--bg-hover)]'
                  }`}
                  style={
                    d.visibility === v.id
                      ? { backgroundColor: `${v.color}10`, borderColor: `${v.color}25`, color: v.color }
                      : {}
                  }
                >
                  <v.Icon className="h-3.5 w-3.5" />
                  {t(`visibility.${v.id}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
              {t('taskCreate.department')}
            </label>
            <select
              value={d.teamId}
              onChange={(e) => set('teamId', e.target.value)}
              className="select-dark w-full h-10 text-[14px] rounded-xl"
            >
              <option value="">{t('common.general')}</option>
              {teams.map((tm: any) => (
                <option key={tm.id} value={tm.id}>{tm.icon} {tm.name}</option>
              ))}
            </select>
          </div>
          {/* List selector (full mode) */}
          {lists && lists.length > 0 && (
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('spaces.lists')}
              </label>
              <select
                value={d.listId}
                onChange={(e) => set('listId', e.target.value)}
                className="select-dark w-full h-10 text-[14px] rounded-xl"
              >
                <option value="">{t('spaces.unsorted')}</option>
                {lists.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ──────── Section 3: Tiempo y Fechas ──────── */}
        {sectionSep(t('taskCreate.sectionDates'))}

        <div className="space-y-3">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.startDate')}
              </label>
              <input
                type="date"
                value={d.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className="input-dark h-10 text-[14px] rounded-xl w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.dueDate')}
              </label>
              <input
                type="date"
                value={d.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className="input-dark h-10 text-[14px] rounded-xl w-full"
              />
            </div>
          </div>

          {/* Time Estimate + Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.timeEstimate')}
              </label>
              <input
                type="number"
                value={d.timeEstimate}
                onChange={(e) => set('timeEstimate', e.target.value)}
                placeholder="60"
                className="input-dark h-10 text-[14px] rounded-xl w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.points')}
              </label>
              <input
                type="number"
                value={d.points}
                onChange={(e) => set('points', e.target.value)}
                placeholder="5"
                className="input-dark h-10 text-[14px] rounded-xl w-full"
              />
            </div>
          </div>
        </div>

        {/* ──────── Section: Recurrencia ──────── */}
        {sectionSep(t('recurrence.recurrence'))}

        <div>
          <RecurrencePicker
            value={d.recurrence}
            onChange={(cfg) => set('recurrence', cfg)}
          />
        </div>

        {/* ──────── Section 4: Responsables ──────── */}
        {sectionSep(t('taskCreate.sectionAssignees'))}

        <div>
          <div className="flex gap-2 flex-wrap">
            {members.map((m: any) => (
              <button
                key={m.id}
                onClick={() => toggleAssignee(m.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  d.assignees.includes(m.id)
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/20'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[10px] font-bold">
                  {m.displayName?.[0]?.toUpperCase()}
                </div>
                {m.displayName}
                {d.assignees.includes(m.id) && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* ──────── Section 5: Etiquetas ──────── */}
        {sectionSep(t('taskCreate.sectionTags'))}

        <div>
          <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-transparent focus-within:border-[var(--accent)]/30 focus-within:ring-1 focus-within:ring-[var(--accent)]/20 transition">
            {d.tags.map((tag: string) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] text-[13px] font-medium"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-[var(--error)] transition ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
              placeholder={d.tags.length === 0 ? t('taskCreate.tagsPlaceholder') : ''}
              className="flex-1 min-w-[80px] h-7 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
        </div>

        {/* ──────── Section 6: Subtareas ──────── */}
        {sectionSep(t('taskCreate.sectionSubtasks'))}

        <div className="space-y-1.5">
          {d.subtasks.map((s: any, i: number) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl px-4 py-2.5 bg-[var(--bg-elevated)]">
              <CheckSquare className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
              <span className="text-[14px] text-[var(--text-secondary)] flex-1">{s.title}</span>
              <button
                onClick={() => set('subtasks', d.subtasks.filter((_: any, j: number) => j !== i))}
                className="text-[var(--text-muted)] hover:text-red-400 transition p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder={t('taskCreate.addSubtask')}
              className="input-dark h-10 text-[14px] rounded-xl flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
            />
            <button
              onClick={addSub}
              className="px-3 h-10 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ──────── Section 7: Campos Legales / Personalizados ──────── */}
        <div className="relative py-5">
          <div className="h-px bg-[var(--border-subtle)]" />
          <button
            onClick={() => setShowFields(!showFields)}
            className="absolute left-4 top-1/2 -translate-y-1/2 px-2 bg-[var(--bg-base)] text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold flex items-center gap-1.5 hover:text-[var(--text-secondary)] transition"
          >
            {t('taskCreate.sectionCustom')}
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${showFields ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <AnimatePresence>
          {showFields && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-4">
                {fieldsLoading ? (
                  <div className="text-[12px] text-[var(--text-muted)] py-2">{t('common.loading')}...</div>
                ) : groups.map((group) => {
                  const groupFields = fieldsByGroup[group.id] || [];
                  if (groupFields.length === 0) return null;
                  const activeInGroup = groupFields.filter((f) => activeFieldIds.includes(f.id));
                  const availableInGroup = groupFields.filter((f) => !activeFieldIds.includes(f.id));
                  const isExpanded = expandedGroups.has(group.id);
                  const groupLabel = lang === 'es' ? group.nameEs : group.name;

                  return (
                    <div key={group.id} className="rounded-2xl bg-[var(--bg-elevated)]/50 p-4">
                      {/* Group header */}
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="flex items-center gap-2 w-full text-left mb-2"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200 ${
                            isExpanded ? '' : '-rotate-90'
                          }`}
                        />
                        <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold">
                          {groupLabel}
                        </span>
                        {activeInGroup.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold">
                            {activeInGroup.length}
                          </span>
                        )}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            {/* Active fields in group */}
                            {activeInGroup.map((f) => renderDynamicFieldInput(f))}

                            {/* Available fields as add buttons */}
                            {availableInGroup.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {availableInGroup.map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => setCustomField(f.id, f.type === 'boolean' ? false : '')}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
                                  >
                                    <Plus className="h-3 w-3" />
                                    {lang === 'es' ? f.nameEs : f.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 flex justify-end gap-2 px-7 py-5 bg-[var(--bg-base)] border-t border-[var(--border-subtle)] rounded-b-2xl">
        <button
          onClick={onClose}
          className="h-11 px-6 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={submit}
          disabled={!d.title.trim()}
          className="h-11 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('common.createTask')}
        </button>
      </div>
    </motion.div>
  );

  // ───────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <AnimatePresence mode="wait">
        {mode === 'quick' ? quickContent : fullContent}
      </AnimatePresence>
    </div>
  );
}
