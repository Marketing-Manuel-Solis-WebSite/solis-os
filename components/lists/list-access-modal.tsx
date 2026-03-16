'use client';

import { useState } from 'react';
import { Lock, Unlock, UserPlus, X, Save, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import type { ListData } from '@/lib/db';

interface ListAccessModalProps {
  list: ListData;
  members: { id: string; displayName: string; email?: string; photoURL?: string }[];
  onSave: (visibility: 'inherited' | 'private', memberIds: string[]) => Promise<void>;
  onClose: () => void;
  open: boolean;
}

export default function ListAccessModal({ list, members, onSave, onClose, open }: ListAccessModalProps) {
  const { t } = useI18n();
  const [visibility, setVisibility] = useState<'inherited' | 'private'>(list.visibility || 'inherited');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set(list.members || []));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const handleToggleMember = (uid: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(visibility, Array.from(selectedMembers));
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = members.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.displayName?.toLowerCase().includes(q)
      || m.email?.toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('lists.manageAccess')}</DialogTitle>
          <DialogDescription>
            {t('lists.manageAccessDesc', { name: list.name })}
          </DialogDescription>
        </DialogHeader>

        {/* Visibility toggle */}
        <div className="space-y-3">
          <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
            {t('lists.visibility')}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setVisibility('inherited')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
                visibility === 'inherited'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Unlock className="h-4 w-4" />
              {t('lists.inherited')}
            </button>
            <button
              onClick={() => setVisibility('private')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
                visibility === 'private'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Lock className="h-4 w-4" />
              {t('lists.private')}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {visibility === 'inherited'
              ? t('lists.inheritedDesc')
              : t('lists.privateDesc')}
          </p>
        </div>

        {/* Member list — only shown when private */}
        {visibility === 'private' && (
          <div className="space-y-3">
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
              {t('lists.members')} ({selectedMembers.size})
            </label>

            {/* Search */}
            <div className="relative">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('lists.searchMembers')}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Member checkboxes */}
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-[var(--border-subtle)] p-2">
              {filteredMembers.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-2">
                  {t('lists.noMembersFound')}
                </p>
              )}
              {filteredMembers.map(m => (
                <label
                  key={m.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(m.id)}
                    onChange={() => handleToggleMember(m.id)}
                    className="w-4 h-4 rounded accent-[var(--accent)]"
                  />
                  {m.photoURL ? (
                    <img src={m.photoURL} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)]">
                      {m.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--text-primary)] truncate block">
                      {m.displayName}
                    </span>
                    {m.email && (
                      <span className="text-[11px] text-[var(--text-muted)] truncate block">
                        {m.email}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (visibility === 'private' && selectedMembers.size === 0)}
            className="px-4 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
