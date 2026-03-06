'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, CheckSquare, Plus, ChevronDown, Zap } from 'lucide-react';
import {
  STATUSES, PRIORITIES, TASK_TYPES, VISIBILITY,
  DEFAULT_CUSTOM_FIELDS, CUSTOM_FIELD_GROUPS,
} from './constants';

interface Props {
  members: any[];
  teams: any[];
  activeTeamId: string;
  onClose: () => void;
  onCreate: (data: any) => void;
}

export default function TaskCreateModal({ members, teams, activeTeamId, onClose, onCreate }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const [d, setD] = useState({
    title: '', description: '', status: 'todo', priority: 'medium', type: 'task',
    assignees: [] as string[], tags: '', dueDate: '', startDate: '', timeEstimate: '',
    points: '', subtasks: [] as any[], visibility: 'team',
    teamId: activeTeamId === '__all__' ? '' : activeTeamId,
    customFields: {} as Record<string, any>,
  });
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

  const submit = () => {
    if (!d.title.trim()) return;
    const out: any = {
      ...d,
      tags: d.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      points: d.points ? Number(d.points) : null,
      timeEstimate: d.timeEstimate ? Number(d.timeEstimate) : null,
    };
    if (d.dueDate) out.dueDate = new Date(d.dueDate);
    if (d.startDate) out.startDate = new Date(d.startDate);
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
  const availableFields = DEFAULT_CUSTOM_FIELDS.filter((f) => !activeFieldIds.includes(f.id));

  const sectionSep = (label: string) => (
    <div className="relative py-5">
      <div className="h-px bg-[var(--border-subtle)]" />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 px-2 bg-[var(--bg-base)] text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold">
        {label}
      </span>
    </div>
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && d.title.trim()) {
      e.preventDefault();
      submit();
    }
  };

  const getInputType = (type: string) => {
    switch (type) {
      case 'currency':
      case 'number': return 'number';
      case 'date': return 'date';
      case 'email': return 'email';
      case 'url': return 'url';
      case 'phone': return 'tel';
      default: return 'text';
    }
  };

  const renderCustomFieldInput = (fid: string) => {
    const def = DEFAULT_CUSTOM_FIELDS.find((f) => f.id === fid);
    if (!def) return null;
    const val = d.customFields[fid];

    return (
      <div key={fid} className="flex items-center gap-2 mb-2">
        <label className="text-sm text-[var(--text-muted)] w-36 shrink-0">{t(`customField.${def.id}`)}</label>
        {def.type === 'checkbox' ? (
          <button
            onClick={() => setCustomField(fid, !val)}
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
              val ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--border)]'
            }`}
          >
            {val && <Check className="h-3 w-3 text-white" />}
          </button>
        ) : def.type === 'select' ? (
          <select
            value={val || ''}
            onChange={(e) => setCustomField(fid, e.target.value)}
            className="select-dark h-10 text-[14px] rounded-xl flex-1"
          >
            <option value="">{t('common.search')}...</option>
            {def.options?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            type={getInputType(def.type)}
            value={val || ''}
            onChange={(e) => setCustomField(fid, e.target.value)}
            placeholder={def.label}
            className="input-dark h-10 text-[14px] rounded-xl flex-1"
            {...(def.type === 'currency' ? { step: '0.01', min: '0' } : {})}
          />
        )}
        <button
          onClick={() => removeCustomField(fid)}
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
        <button
          onClick={onClose}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setMode('full')}
            className="text-[13px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Mas opciones
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
              Crear
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
        {sectionSep('Identidad')}

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
        {sectionSep('Organizacion')}

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
        </div>

        {/* ──────── Section 3: Tiempo y Fechas ──────── */}
        {sectionSep('Tiempo y Fechas')}

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

        {/* ──────── Section 4: Responsables ──────── */}
        {sectionSep('Responsables')}

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
        {sectionSep('Etiquetas')}

        <div>
          <input
            value={d.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder={t('taskCreate.tagsPlaceholder')}
            className="input-dark h-10 text-[14px] rounded-xl w-full"
          />
        </div>

        {/* ──────── Section 6: Subtareas ──────── */}
        {sectionSep('Subtareas')}

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
            Campos Personalizados
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
                {CUSTOM_FIELD_GROUPS.map((group) => {
                  const groupFields = DEFAULT_CUSTOM_FIELDS.filter((f) => f.group === group.id);
                  const activeInGroup = groupFields.filter((f) => activeFieldIds.includes(f.id));
                  const availableInGroup = groupFields.filter((f) => !activeFieldIds.includes(f.id));
                  const isExpanded = expandedGroups.has(group.id);

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
                          {t(group.labelKey)}
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
                            {activeInGroup.map((f) => renderCustomFieldInput(f.id))}

                            {/* Available fields as add buttons */}
                            {availableInGroup.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {availableInGroup.map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => setCustomField(f.id, f.type === 'checkbox' ? false : '')}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
                                  >
                                    <Plus className="h-3 w-3" />
                                    {t(`customField.${f.id}`)}
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
          Crear Tarea
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
