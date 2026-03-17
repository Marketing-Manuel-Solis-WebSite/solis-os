'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';
import {
  Eye, Trash2, Search, Loader2, Archive, CheckSquare,
  Globe, Lock, Shield, Users, Layers, FolderOpen, List as ListIcon,
} from 'lucide-react';
import { useToast } from '@/components/notifications/toast-provider';
import type { ViewDefinition, ViewScopeType, ViewVisibility } from '@/types';

export default function ViewGovernancePanel() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [views, setViews] = useState<ViewDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ViewScopeType | 'all'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<ViewVisibility | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadViews = async () => {
    setLoading(true);
    try {
      const orgId = getCurrentOrgId();
      const col = collection(db, 'orgs', orgId, 'views');
      const snap = await getDocs(col);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as ViewDefinition));
      setViews(all);
    } catch (err) {
      console.error('[ViewGovernance] Failed to load views:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadViews(); }, []);

  // Derived
  const viewTypes = useMemo(() => {
    const types = new Set(views.map(v => v.viewType).filter(Boolean));
    return Array.from(types).sort();
  }, [views]);

  const filtered = useMemo(() => {
    return views.filter(v => {
      if (scopeFilter !== 'all' && v.scopeType !== scopeFilter) return false;
      if (visibilityFilter !== 'all' && v.visibility !== visibilityFilter) return false;
      if (typeFilter !== 'all' && v.viewType !== typeFilter) return false;
      if (search && !v.name?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [views, scopeFilter, visibilityFilter, typeFilter, search]);

  const staleViews = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return views.filter(v => {
      const updated = v.updatedAt?.seconds ? v.updatedAt.seconds * 1000
        : v.updatedAt?.toDate ? v.updatedAt.toDate().getTime()
        : 0;
      return updated > 0 && updated < thirtyDaysAgo;
    });
  }, [views]);

  const visibilityBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    views.forEach(v => {
      const k = v.visibility || 'public';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [views]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(v => v.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(t('admin.viewsConfirmDelete', { n: selected.size }))) return;
    setDeleting(true);
    try {
      const orgId = getCurrentOrgId();
      const col = collection(db, 'orgs', orgId, 'views');
      const promises = Array.from(selected).map(id => deleteDoc(doc(col, id)));
      await Promise.all(promises);
      toast.success(t('admin.viewsDeleted', { n: selected.size }));
      setSelected(new Set());
      loadViews();
    } catch (err) {
      console.error('[ViewGovernance] Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveStale = async () => {
    if (staleViews.length === 0) return;
    if (!confirm(t('admin.viewsConfirmDelete', { n: staleViews.length }))) return;
    setDeleting(true);
    try {
      const orgId = getCurrentOrgId();
      const col = collection(db, 'orgs', orgId, 'views');
      const promises = staleViews.map(v => deleteDoc(doc(col, v.id)));
      await Promise.all(promises);
      toast.success(t('admin.viewsDeleted', { n: staleViews.length }));
      setSelected(new Set());
      loadViews();
    } catch (err) {
      console.error('[ViewGovernance] Archive stale failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const SCOPE_ICONS: Record<string, any> = {
    space: Layers, folder: FolderOpen, list: ListIcon, global: Globe,
  };
  const VISIBILITY_ICONS: Record<string, any> = {
    private: Lock, public: Globe, protected: Shield, space_members: Users, required: CheckSquare,
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
          <Eye className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('admin.views')}</h2>
          <p className="text-[13px] text-[var(--text-muted)]">{t('admin.viewsDesc')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] shadow-card">
          <p className="text-xl font-bold text-[var(--text-primary)]">{views.length}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{t('admin.viewCount', { n: '' }).replace(' ', ' total')}</p>
        </div>
        {Object.entries(visibilityBreakdown).slice(0, 3).map(([vis, count]) => (
          <div key={vis} className="p-3 rounded-xl bg-[var(--bg-secondary)] shadow-card">
            <p className="text-xl font-bold text-[var(--text-primary)]">{count}</p>
            <p className="text-[12px] text-[var(--text-muted)] capitalize">{vis}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'es' ? 'Buscar vistas...' : 'Search views...'}
            className="input-dark pl-10 h-9 text-sm"
          />
        </div>
        <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value as any)} className="select-dark h-9 text-sm">
          <option value="all">{t('admin.viewsScopeFilter')}</option>
          <option value="space">Space</option>
          <option value="folder">Folder</option>
          <option value="list">List</option>
          <option value="global">Global</option>
        </select>
        <select value={visibilityFilter} onChange={e => setVisibilityFilter(e.target.value as any)} className="select-dark h-9 text-sm">
          <option value="all">{t('admin.viewsVisibilityFilter')}</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="protected">Protected</option>
          <option value="required">Required</option>
          <option value="space_members">Space Members</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="select-dark h-9 text-sm">
          <option value="all">{t('admin.viewsTypeFilter')}</option>
          {viewTypes.map(vt => <option key={vt} value={vt}>{vt}</option>)}
        </select>

        {/* Actions */}
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('admin.viewsBulkDelete')} ({selected.size})
          </button>
        )}
        {staleViews.length > 0 && (
          <button
            onClick={handleArchiveStale}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
            {t('admin.viewsStale')} ({staleViews.length})
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Eye className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-sm text-[var(--text-muted)]">{t('admin.viewsNone')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--bg-secondary)]">
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{lang === 'es' ? 'Nombre' : 'Name'}</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{lang === 'es' ? 'Tipo' : 'Type'}</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Scope</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{lang === 'es' ? 'Visibilidad' : 'Visibility'}</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{lang === 'es' ? 'Creador' : 'Creator'}</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center">{lang === 'es' ? 'Fijada' : 'Pinned'}</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center">{lang === 'es' ? 'Default' : 'Default'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((view, i) => {
                const ScopeIcon = SCOPE_ICONS[view.scopeType] || Globe;
                const VisIcon = VISIBILITY_ICONS[view.visibility] || Globe;
                return (
                  <tr
                    key={view.id}
                    className={`border-t border-[var(--border-subtle)] transition ${
                      selected.has(view.id) ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(view.id)}
                        onChange={() => toggleSelect(view.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">{view.name || '(untitled)'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[12px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">{view.viewType || '—'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
                        <ScopeIcon className="h-3 w-3" />
                        {view.scopeType}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
                        <VisIcon className="h-3 w-3" />
                        {view.visibility}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[12px] text-[var(--text-muted)] truncate max-w-[120px] block">{view.createdBy || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {view.isPinned ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">Yes</span> : <span className="text-[11px] text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {view.isDefault ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">Yes</span> : <span className="text-[11px] text-[var(--text-muted)]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      <div className="mt-3 text-[12px] text-[var(--text-muted)]">
        {t('admin.viewCount', { n: filtered.length })}
        {filtered.length !== views.length && ` / ${views.length} total`}
      </div>
    </div>
  );
}
