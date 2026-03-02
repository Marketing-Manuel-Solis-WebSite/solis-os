'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, FileText, Search, Lock, Globe, Users, Star, StarOff,
  Filter, X, Sparkles, Paperclip, Calendar, User, Loader2,
} from 'lucide-react';
import {
  getDocuments, createDocument, updateDocument, deleteDocument, logAction,
  getMembers
} from '@/lib/db';
import { renderMarkdown } from '@/lib/markdown';
import DocEditor from '@/components/docs/doc-editor';
import DocAIPanel from '@/components/docs/doc-ai-panel';
import { useToast } from '@/components/notifications/toast-provider';

// ========== TYPES ==========
interface Doc {
  id: string;
  title: string;
  content: string;
  contentHtml: string;
  teamId: string;
  createdBy: string;
  createdByName: string;
  visibility: 'team' | 'private' | 'public';
  starred: boolean;
  tags: string[];
  category: string;
  lastEditedBy: string;
  lastEditedByName: string;
  wordCount: number;
  createdAt: any;
  updatedAt: any;
}

// ========== MAIN PAGE ==========
export default function DocsPage() {
  const { user, me, isAdmin, activeTeamId, teams, can, canSeeResource, canSeeAllTeams } = useAuth();
  const toast = useToast();

  // State
  const [docs, setDocs] = useState<Doc[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title' | 'wordCount'>('updated');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'team' | 'private' | 'public'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterDate, setFilterDate] = useState<'all' | '7' | '30' | '90' | '365'>('all');
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Load docs
  const load = useCallback(async () => {
    try {
      const [rawDocs, rawMembers] = await Promise.all([
        getDocuments(activeTeamId),
        getMembers()
      ]);
      setMembers(rawMembers);

      // Role-based filtering using canSeeResource
      let filtered = rawDocs as Doc[];
      if (!canSeeAllTeams) {
        filtered = filtered.filter((d: Doc) => canSeeResource({
          teamId: d.teamId,
          createdBy: d.createdBy,
          visibility: d.visibility,
        }));
      }

      setDocs(filtered);
    } catch (err) {
      toast.error('Error cargando documentos', 'No se pudieron cargar los documentos.');
    }
    setLoading(false);
  }, [activeTeamId, canSeeAllTeams, canSeeResource, user?.uid]);

  useEffect(() => {
    setLoading(true);
    setActiveDoc(null);
    load();
  }, [load]);

  // Filter + Sort
  let visible = docs.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.title?.toLowerCase().includes(q) &&
          !d.content?.toLowerCase().includes(q) &&
          !d.tags?.some((t: string) => t.toLowerCase().includes(q))) return false;
    }
    if (filterVisibility !== 'all' && d.visibility !== filterVisibility) return false;
    if (filterCategory !== 'all' && d.category !== filterCategory) return false;
    if (filterDept !== 'all' && d.teamId !== filterDept) return false;
    if (filterAuthor !== 'all' && d.createdBy !== filterAuthor) return false;
    if (filterStarred && !d.starred) return false;
    if (filterDate !== 'all') {
      const days = parseInt(filterDate);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const docTime = d.updatedAt?.seconds ? d.updatedAt.seconds * 1000 : 0;
      if (docTime < cutoff) return false;
    }
    return true;
  });

  visible.sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    switch (sortBy) {
      case 'title': return (a.title || '').localeCompare(b.title || '');
      case 'wordCount': return (b.wordCount || 0) - (a.wordCount || 0);
      case 'created': return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      default: return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
    }
  });

  // Extract unique values
  const categories = [...new Set(docs.map(d => d.category).filter(Boolean))];
  const uniqueAuthors: { id: string; name: string }[] = [];
  const seenAuthors = new Set<string>();
  for (const d of docs) {
    if (d.createdBy && !seenAuthors.has(d.createdBy)) {
      seenAuthors.add(d.createdBy);
      uniqueAuthors.push({ id: d.createdBy, name: d.createdByName || 'Unknown' });
    }
  }

  // CRUD
  const handleCreate = async (data: Partial<Doc>) => {
    await createDocument({
      ...data,
      teamId: data.teamId || (activeTeamId === '__all__' ? '' : activeTeamId),
      createdBy: user!.uid,
      createdByName: me!.displayName,
      lastEditedBy: user!.uid,
      lastEditedByName: me!.displayName,
      visibility: data.visibility || 'team',
      starred: false,
      tags: data.tags || [],
      category: data.category || '',
      wordCount: 0,
      contentHtml: '',
    });
    await logAction({ action: 'created', resource: 'doc', detail: data.title || '', actorId: user!.uid, actorName: me!.displayName });
    setShowCreate(false);
    await load();
    // Open newest
    const refreshed = await getDocuments(activeTeamId);
    const newest = (refreshed as Doc[]).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
    if (newest) setActiveDoc(newest);
  };

  const handleSave = async (id: string, data: Partial<Doc>) => {
    const wc = (data.content || '').split(/\s+/).filter(Boolean).length;
    await updateDocument(id, {
      ...data,
      lastEditedBy: user!.uid,
      lastEditedByName: me!.displayName,
      wordCount: wc,
    });
    await load();
    if (activeDoc?.id === id) {
      setActiveDoc(prev => prev ? { ...prev, ...data, wordCount: wc } : null);
    }
  };

  const handleDelete = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await deleteDocument(doc.id);
    await logAction({ action: 'deleted', resource: 'doc', detail: doc.title, actorId: user!.uid, actorName: me!.displayName });
    if (activeDoc?.id === doc.id) setActiveDoc(null);
    load();
  };

  const handleToggleStar = async (doc: Doc) => {
    await updateDocument(doc.id, { starred: !doc.starred });
    load();
  };

  // Handle AI insert (append to document)
  const handleAIInsert = (content: string) => {
    if (!activeDoc) return;
    const newContent = activeDoc.content ? `${activeDoc.content}\n\n${content}` : content;
    handleSave(activeDoc.id, {
      content: newContent,
      contentHtml: renderMarkdown(newContent),
    });
    setActiveDoc(prev => prev ? { ...prev, content: newContent } : null);
  };

  // If viewing a document
  if (activeDoc) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <div className="flex-1 flex flex-col min-w-0">
          <DocEditor
            doc={activeDoc}
            members={members}
            isAdmin={isAdmin}
            userId={user!.uid}
            onSave={handleSave}
            onDelete={handleDelete}
            onBack={() => setActiveDoc(null)}
            onToggleAI={() => setShowAI(!showAI)}
            showAI={showAI}
          />
        </div>
        {showAI && (
          <DocAIPanel
            doc={activeDoc}
            onClose={() => setShowAI(false)}
            onApply={(content: string) => handleSave(activeDoc.id, { content, contentHtml: renderMarkdown(content) })}
            onInsert={handleAIInsert}
          />
        )}
      </div>
    );
  }

  // Check if any filter is active
  const hasActiveFilters = filterVisibility !== 'all' || filterCategory !== 'all' || filterDept !== 'all' || filterAuthor !== 'all' || filterStarred || filterDate !== 'all';

  const clearFilters = () => {
    setFilterVisibility('all');
    setFilterCategory('all');
    setFilterDept('all');
    setFilterAuthor('all');
    setFilterStarred(false);
    setFilterDate('all');
    setSearch('');
  };

  // Document list view
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-slide">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            Documents
            {canSeeAllTeams && (
              <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent)] font-semibold">
                ALL ACCESS
              </span>
            )}
          </h1>
          <p className="text-base text-[var(--text-muted)] mt-1">
            {visible.length} document{visible.length !== 1 ? 's' : ''}
            {hasActiveFilters && <span className="text-[var(--accent)]"> (filtered)</span>}
          </p>
        </div>
        {can('doc', 'create') && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">
            <Plus className="h-4 w-4" /> New Document
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-5 anim-slide" style={{ animationDelay: '60ms' }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="input-dark pl-10 h-9 text-sm" />
        </div>

        {/* Department filter */}
        {canSeeAllTeams && teams.length > 0 && (
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="select-dark h-9 text-sm">
            <option value="all">All Departments</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            <option value="">No Department</option>
          </select>
        )}

        {/* Author filter */}
        {uniqueAuthors.length > 1 && (
          <select value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)} className="select-dark h-9 text-sm">
            <option value="all">All Authors</option>
            {uniqueAuthors.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        <select value={filterVisibility} onChange={e => setFilterVisibility(e.target.value as any)} className="select-dark h-9 text-sm">
          <option value="all">All Visibility</option>
          <option value="team">Team Only</option>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>

        {categories.length > 0 && (
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="select-dark h-9 text-sm">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Date range filter */}
        <select value={filterDate} onChange={e => setFilterDate(e.target.value as any)} className="select-dark h-9 text-sm">
          <option value="all">Any Time</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
          <option value="365">Last Year</option>
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="select-dark h-9 text-sm">
          <option value="updated">Last Modified</option>
          <option value="created">Newest First</option>
          <option value="title">A → Z</option>
          <option value="wordCount">Word Count</option>
        </select>

        {/* Starred toggle */}
        <button onClick={() => setFilterStarred(!filterStarred)}
          className={`h-9 px-3 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all duration-200 ${
            filterStarred
              ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:shadow-card-hover'
          }`}>
          <Star className={`h-3 w-3 ${filterStarred ? 'fill-[var(--accent)]' : ''}`} />
          Starred
        </button>

        {hasActiveFilters && (
          <button onClick={clearFilters}
            className="h-9 px-3 rounded-xl border border-red-500/20 text-sm text-red-400 hover:bg-red-500/10 transition flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}

        <div className="flex rounded-xl bg-[var(--bg-tertiary)] overflow-hidden">
          <button onClick={() => setView('grid')} className={`px-3 py-1.5 text-xs ${view === 'grid' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
          </button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs ${view === 'list' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2.5" rx="0.5" /><rect x="1" y="6.75" width="14" height="2.5" rx="0.5" /><rect x="1" y="11.5" width="14" height="2.5" rx="0.5" /></svg>
          </button>
        </div>
      </div>

      {/* Document Grid/List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-44 skeleton rounded-lg" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-14 w-14 text-[var(--text-muted)] mx-auto mb-4" />
          <p className="text-[var(--text-muted)] text-sm mb-2">
            {hasActiveFilters ? 'No documents match your filters.' : 'No documents found.'}
          </p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className="text-sm text-[var(--accent)] hover:underline">Clear filters</button>
          ) : (
            <button onClick={() => setShowCreate(true)} className="text-sm text-[var(--accent)] hover:underline">Create your first document</button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((d, i) => (
            <DocCard key={d.id} doc={d} index={i} teams={teams}
              onClick={() => setActiveDoc(d)}
              onDelete={() => handleDelete(d)}
              onToggleStar={() => handleToggleStar(d)}
              isOwner={d.createdBy === user?.uid || can('doc', 'delete')}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map((d, i) => (
            <DocListItem key={d.id} doc={d} index={i} teams={teams}
              onClick={() => setActiveDoc(d)}
              onDelete={() => handleDelete(d)}
              onToggleStar={() => handleToggleStar(d)}
              isOwner={d.createdBy === user?.uid || can('doc', 'delete')}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateDocModal
          teams={teams}
          activeTeamId={activeTeamId}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

// ========== DOC CARD ==========
function DocCard({ doc, index, teams, onClick, onDelete, onToggleStar, isOwner }: {
  doc: Doc; index: number; teams: any[];
  onClick: () => void; onDelete: () => void; onToggleStar: () => void; isOwner: boolean;
}) {
  const team = teams.find((t: any) => t.id === doc.teamId);
  const preview = (doc.content || '').replace(/[#*_`>\-\[\]!()]/g, '').replace(/\n+/g, ' ').slice(0, 120);
  const updated = doc.updatedAt?.toDate?.();
  const visIcon = doc.visibility === 'private' ? <Lock className="h-3 w-3" /> : doc.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Users className="h-3 w-3" />;
  const visColor = doc.visibility === 'private' ? 'text-red-400' : doc.visibility === 'public' ? 'text-emerald-400' : 'text-blue-400';

  // Author initial
  const authorInitial = (doc.createdByName || '?')[0].toUpperCase();
  const authorColor = team?.color || '#3B82F6';

  // Count images as attachments
  const imgCount = (doc.content || '').match(/!\[.*?\]\(.*?\)/g)?.length || 0;

  return (
    <div onClick={onClick}
      className="group relative rounded-xl bg-[var(--bg-secondary)] shadow-card hover:shadow-card-hover hover:bg-[var(--bg-hover)] p-5 cursor-pointer anim-slide overflow-hidden transition-all duration-200"
      style={{ animationDelay: `${index * 40}ms` }}>
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ background: team ? `linear-gradient(90deg, ${team.color}60, transparent)` : 'linear-gradient(90deg, rgba(212,168,67,0.4), transparent)' }} />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Author avatar */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white"
            style={{ backgroundColor: `${authorColor}30`, color: authorColor }}>
            {authorInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{doc.title || 'Untitled'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {team && (
                <span className="text-[12px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${team.color}15`, color: team.color }}>
                  {team.icon} {team.name}
                </span>
              )}
              <span className="text-[12px] text-[var(--text-muted)]">{doc.createdByName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onToggleStar(); }} className="p-1 rounded-lg hover:bg-white/5 transition">
            {doc.starred ? <Star className="h-3.5 w-3.5 text-[var(--accent)] fill-[var(--accent)]" /> : <StarOff className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />}
          </button>
          {isOwner && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-[var(--text-muted)] line-clamp-3 mb-4 min-h-[3rem] leading-relaxed">{preview || 'Empty document...'}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[12px] ${visColor}`}>{visIcon}{doc.visibility}</span>
          {imgCount > 0 && (
            <span className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
              <Paperclip className="h-2.5 w-2.5" />{imgCount}
            </span>
          )}
          {doc.tags?.slice(0, 2).map((t: string) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">{t}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {doc.wordCount > 0 && <span className="text-[12px] text-[var(--text-muted)]">{doc.wordCount}w</span>}
          {updated && <span className="text-[12px] text-[var(--text-muted)]">{updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        </div>
      </div>
    </div>
  );
}

// ========== DOC LIST ITEM ==========
function DocListItem({ doc, index, teams, onClick, onDelete, onToggleStar, isOwner }: {
  doc: Doc; index: number; teams: any[];
  onClick: () => void; onDelete: () => void; onToggleStar: () => void; isOwner: boolean;
}) {
  const team = teams.find((t: any) => t.id === doc.teamId);
  const updated = doc.updatedAt?.toDate?.();
  const visIcon = doc.visibility === 'private' ? <Lock className="h-3 w-3" /> : doc.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Users className="h-3 w-3" />;
  const visColor = doc.visibility === 'private' ? 'text-red-400' : doc.visibility === 'public' ? 'text-emerald-400' : 'text-blue-400';
  const authorInitial = (doc.createdByName || '?')[0].toUpperCase();
  const authorColor = team?.color || '#3B82F6';
  const imgCount = (doc.content || '').match(/!\[.*?\]\(.*?\)/g)?.length || 0;

  return (
    <div onClick={onClick}
      className="group flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[var(--bg-secondary)] shadow-card hover:shadow-card-hover hover:bg-[var(--bg-hover)] cursor-pointer anim-slide transition-all duration-200"
      style={{ animationDelay: `${index * 25}ms` }}>
      <button onClick={e => { e.stopPropagation(); onToggleStar(); }} className="shrink-0">
        {doc.starred ? <Star className="h-4 w-4 text-[var(--accent)] fill-[var(--accent)]" /> : <StarOff className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition" />}
      </button>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
        style={{ backgroundColor: `${authorColor}20`, color: authorColor }}>
        {authorInitial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{doc.title || 'Untitled'}</p>
        <p className="text-[13px] text-[var(--text-muted)] truncate">{(doc.content || '').replace(/[#*_`>\-\[\]!()]/g, '').replace(/\n+/g, ' ').slice(0, 80) || 'Empty'}</p>
      </div>
      {team && <span className="text-[12px] px-2 py-0.5 rounded-md font-medium shrink-0" style={{ backgroundColor: `${team.color}15`, color: team.color }}>{team.icon} {team.name}</span>}
      <span className={`flex items-center gap-1 text-[12px] shrink-0 ${visColor}`}>{visIcon}</span>
      {imgCount > 0 && (
        <span className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] shrink-0">
          <Paperclip className="h-2.5 w-2.5" />{imgCount}
        </span>
      )}
      {doc.wordCount > 0 && <span className="text-[12px] text-[var(--text-muted)] shrink-0">{doc.wordCount}w</span>}
      {updated && <span className="text-[12px] text-[var(--text-muted)] shrink-0">{updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
      <span className="text-[12px] text-[var(--text-muted)] shrink-0">{doc.createdByName}</span>
      {isOwner && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ========== CREATE DOC MODAL ==========
function CreateDocModal({ teams, activeTeamId, onClose, onCreate }: {
  teams: any[]; activeTeamId: string; onClose: () => void; onCreate: (data: Partial<Doc>) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'private' | 'public'>('team');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [deptId, setDeptId] = useState(activeTeamId === '__all__' ? '' : activeTeamId);
  const [template, setTemplate] = useState('blank');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const templates: { id: string; label: string; content: string }[] = [
    { id: 'blank', label: 'Blank', content: '' },
    { id: 'meeting', label: 'Meeting Notes', content: '# Meeting Notes\n\n**Date:** \n**Attendees:** \n**Agenda:**\n\n---\n\n## Discussion Points\n\n### Topic 1\n\n\n### Topic 2\n\n\n---\n\n## Action Items\n\n- [ ] \n- [ ] \n\n---\n\n## Next Steps\n\n' },
    { id: 'case', label: 'Case Summary', content: '# Case Summary\n\n**Case Number:** \n**Client:** \n**Case Type:** \n**Filing Date:** \n**Court:** \n\n---\n\n## Case Overview\n\n\n## Key Facts\n\n\n## Legal Analysis\n\n\n## Strategy\n\n\n## Timeline / Deadlines\n\n| Date | Event | Status |\n|------|-------|--------|\n|      |       |        |\n\n## Notes\n\n' },
    { id: 'sop', label: 'SOP', content: '# [Procedure Name]\n\n**Department:** \n**Version:** 1.0\n**Effective Date:** \n\n---\n\n## Purpose\n\n\n## Procedure Steps\n\n### Step 1: \n\n\n### Step 2: \n\n\n### Step 3: \n\n' },
    { id: 'report', label: 'Report', content: '# [Report Title]\n\n**Prepared by:** \n**Date:** \n\n---\n\n## Executive Summary\n\n\n## Key Findings\n\n\n## Recommendations\n\n1. \n2. \n3. \n\n## Conclusion\n\n' },
    { id: 'letter', label: 'Client Letter', content: '# Client Letter\n\n**Date:** \n**To:** \n**Re:** \n\n---\n\nDear [Client Name],\n\n\n\nSincerely,\n\n**Law Office of Manuel Solis**\n' },
    { id: 'ai', label: 'AI Generate', content: '' },
  ];

  const submit = async () => {
    if (!title.trim()) return;

    if (template === 'ai' && aiPrompt.trim()) {
      setAiGenerating(true);
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: `You are a professional document writer for a law office. Create a complete, well-structured document in markdown format.\n\nDocument Title: "${title.trim()}"\n\nDescription: ${aiPrompt.trim()}\n\nWrite the full document content in markdown format:`,
          }),
        });
        const data = await res.json();
        const aiContent = data.answer || '';
        onCreate({
          title: title.trim(),
          content: aiContent,
          contentHtml: renderMarkdown(aiContent),
          visibility,
          category: category.trim(),
          tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
          teamId: deptId,
        });
      } catch {
        toast.warning('Error al generar contenido AI', 'Se creará un documento en blanco.');
        onCreate({
          title: title.trim(), content: '', contentHtml: '', visibility,
          category: category.trim(), tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean), teamId: deptId,
        });
      }
      setAiGenerating(false);
      return;
    }

    const tpl = templates.find(t => t.id === template);
    onCreate({
      title: title.trim(),
      content: tpl?.content || '',
      contentHtml: tpl?.content || '',
      visibility,
      category: category.trim(),
      tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      teamId: deptId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[var(--bg-base)] rounded-xl shadow-modal anim-slide overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">New Document</h2>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title..."
              autoFocus className="w-full h-12 px-4 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] text-lg font-semibold placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
              onKeyDown={e => e.key === 'Enter' && template !== 'ai' && submit()} />
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {templates.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    template === t.id
                      ? t.id === 'ai'
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)] shadow-card'
                        : 'bg-[var(--accent-subtle)] text-[var(--accent)] shadow-card'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:shadow-card-hover'
                  }`}>
                  {t.id === 'ai' && <Sparkles className="h-3 w-3 shrink-0" />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI prompt when AI template selected */}
          {template === 'ai' && (
            <div className="anim-fade">
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">
                Describe the document for AI
              </label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="E.g. Write a client intake form for immigration cases with fields for personal information, case history, and documents needed..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 resize-none"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Department</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className="select-dark w-full">
                <option value="">No Department</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Visibility</label>
              <select value={visibility} onChange={e => setVisibility(e.target.value as any)} className="select-dark w-full">
                <option value="team">Team</option>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Legal, HR..." className="input-dark h-[38px] text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="immigration, filing, urgent" className="input-dark h-9 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5">
          <button onClick={onClose} className="px-5 h-10 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">Cancel</button>
          <button onClick={submit} disabled={!title.trim() || aiGenerating || (template === 'ai' && !aiPrompt.trim())}
            className="px-6 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40 flex items-center gap-2">
            {aiGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : template === 'ai' ? (
              <><Sparkles className="h-4 w-4" /> Generate & Create</>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
