'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MoreVertical, Share2, Copy, Pause, Archive, Trash2, Eye, FileText } from 'lucide-react';
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
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] outline-none transition-all"
            placeholder={t('forms.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
          >
            {t('tasks.all')}
          </button>
          {FORM_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === s.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> {t('forms.createForm')}
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-muted)]">{search ? t('common.noResults') : t('forms.noForms')}</p>
          {!search && <p className="text-[13px] text-[var(--text-muted)] mt-1">{t('forms.noFormsDesc')}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(f => {
              const statusInfo = FORM_STATUSES.find(s => s.value === f.status);
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="relative group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] hover:border-[var(--border-default)] hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => onSelect(f)}
                >
                  <div className="p-4 space-y-2.5">
                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${statusInfo?.color}20`, color: statusInfo?.color }}
                      >
                        {t(statusInfo?.labelKey || 'forms.statusDraft')}
                      </span>
                      <div className="relative">
                        <button
                          onClick={e => { e.stopPropagation(); setMenuId(menuId === f.id ? null : f.id); }}
                          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuId === f.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown border border-[var(--border-subtle)] py-1 z-20" onClick={e => e.stopPropagation()}>
                            <MenuItem icon={Eye} label={t('forms.preview')} onClick={() => { onSelect(f); setMenuId(null); }} />
                            <MenuItem icon={Share2} label={t('forms.share')} onClick={() => { onShare(f); setMenuId(null); }} />
                            {f.status === 'draft' && <MenuItem icon={Eye} label={t('forms.publish')} onClick={() => handleStatusChange(f, 'published')} />}
                            {f.status === 'published' && <MenuItem icon={Pause} label={t('forms.pause')} onClick={() => handleStatusChange(f, 'paused')} />}
                            {f.status !== 'archived' && <MenuItem icon={Archive} label={t('forms.archive')} onClick={() => handleStatusChange(f, 'archived')} />}
                            <MenuItem icon={Trash2} label={t('common.delete')} onClick={() => handleDelete(f)} danger />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {f.title || t('formBuilder.title')}
                    </h3>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
                      <span>{t('forms.nResponses', { n: f.responseCount })}</span>
                      <span>{f.fields.length} {t('submissions.fieldValues').toLowerCase()}</span>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)]">
                      {t('forms.createdBy', { name: f.createdByName || '—' })}
                    </p>
                  </div>
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
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-all hover:bg-[var(--bg-hover)] ${danger ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
