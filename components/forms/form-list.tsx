'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MoreHorizontal, Share2, Pause, Archive, Trash2, Eye, FileText, Globe } from 'lucide-react';
import type { FormDocument, FormStatus } from './constants';
import { FORM_STATUSES } from './constants';
import { useI18n } from '@/lib/i18n';
import { deleteForm, updateForm } from '@/lib/db';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  forms: FormDocument[];
  onSelect: (form: FormDocument) => void;
  onShare: (form: FormDocument) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#8E8EA8',
  published: '#00C48C',
  paused: '#FFB545',
  archived: '#A0A0B8',
};

export default function FormList({ forms, onSelect, onShare, onCreate, onRefresh }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FormStatus | 'all'>('all');
  const [menuId, setMenuId] = useState<string | null>(null);

  const filtered = forms.filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (f: FormDocument) => {
    if (!confirm(t('forms.deleteConfirm'))) return;
    try {
      await deleteForm(f.id);
      toast.success(t('common.delete'));
      onRefresh();
    } catch {
      toast.error(t('conversion.error'));
    }
    setMenuId(null);
  };

  const handleStatusChange = async (f: FormDocument, status: FormStatus) => {
    try {
      await updateForm(f.id, { status });
      toast.success(t('tasks.updated'));
      onRefresh();
    } catch {
      toast.error(t('conversion.error'));
    }
    setMenuId(null);
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all"
            placeholder={t('forms.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-xl p-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            {t('tasks.all')}
          </button>
          {FORM_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === s.value ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-10 w-10 text-[var(--text-muted)]/20 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            {search ? t('common.noResults') : t('forms.noForms')}
          </h3>
          {!search && <p className="text-[14px] text-[var(--text-muted)] mb-4">{t('forms.noFormsDesc')}</p>}
          {!search && (
            <button
              onClick={onCreate}
              className="text-[var(--accent)] text-sm font-medium hover:underline"
            >
              {t('forms.createForm')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((f, i) => {
              const statusInfo = FORM_STATUSES.find(s => s.value === f.status);
              const color = STATUS_COLORS[f.status] || '#8E8EA8';
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.04 }}
                  className="group relative rounded-xl bg-[var(--bg-secondary)] shadow-card hover:shadow-card-hover p-5 cursor-pointer overflow-hidden transition-all duration-200"
                  onClick={() => onSelect(f)}
                >
                  {/* Top accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                    style={{ background: `linear-gradient(90deg, ${color}60, transparent)` }}
                  />

                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      {t(statusInfo?.labelKey || 'forms.statusDraft')}
                    </span>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === f.id ? null : f.id); }}
                        className="p-1 rounded-md text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      <AnimatePresence>
                        {menuId === f.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown border border-[var(--border-subtle)] py-1 z-20"
                            onClick={e => e.stopPropagation()}
                          >
                            <MenuItem icon={Eye} label={t('forms.preview')} onClick={() => { onSelect(f); setMenuId(null); }} />
                            <MenuItem icon={Share2} label={t('forms.share')} onClick={() => { onShare(f); setMenuId(null); }} />
                            {f.status === 'draft' && <MenuItem icon={Globe} label={t('forms.publish')} onClick={() => handleStatusChange(f, 'published')} />}
                            {f.status === 'published' && <MenuItem icon={Pause} label={t('forms.pause')} onClick={() => handleStatusChange(f, 'paused')} />}
                            {f.status !== 'archived' && <MenuItem icon={Archive} label={t('forms.archive')} onClick={() => handleStatusChange(f, 'archived')} />}
                            <div className="my-1 border-t border-[var(--border-subtle)]" />
                            <MenuItem icon={Trash2} label={t('common.delete')} onClick={() => handleDelete(f)} danger />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate mb-2">
                    {f.title || t('formBuilder.title')}
                  </h3>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
                    <span>{t('forms.nResponses', { n: f.responseCount })}</span>
                    <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]/30" />
                    <span>{f.fields.length} {t('submissions.fieldValues').toLowerCase()}</span>
                  </div>
                  <p className="text-[12px] text-[var(--text-muted)] mt-1.5">
                    {t('forms.createdBy', { name: f.createdByName || '—' })}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-all hover:bg-[var(--bg-hover)] ${danger ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
