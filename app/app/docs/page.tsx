'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, FileText, Search, Lock, Globe, Users, Star, StarOff,
  Filter, X, Sparkles
} from 'lucide-react';
import {
  getDocuments, createDocument, updateDocument, deleteDocument, logAction,
  getMembers
} from '@/lib/db';
import DocEditor from '@/components/docs/doc-editor';
import DocAIPanel from '@/components/docs/doc-ai-panel';

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
  const { user, me, isAdmin, activeTeamId, teams } = useAuth();

  // State
  const [docs, setDocs] = useState<Doc[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title' | 'wordCount'>('updated');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'team' | 'private' | 'public'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
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

      // Role-based filtering
      let filtered = rawDocs as Doc[];
      if (!isAdmin) {
        filtered = filtered.filter((d: Doc) => {
          if (d.createdBy === user?.uid) return true;
          if (d.visibility === 'public') return true;
          if (d.visibility === 'team' && d.teamId === activeTeamId) return true;
          return false;
        });
      }

      setDocs(filtered);
    } catch (err) {
      console.error('Load docs error:', err);
    }
    setLoading(false);
  }, [activeTeamId, isAdmin, user?.uid]);

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

  // Extract unique categories
  const categories = [...new Set(docs.map(d => d.category).filter(Boolean))];

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
            onApply={(content: string) => handleSave(activeDoc.id, { content, contentHtml: content })}
          />
        )}
      </div>
    );
  }

  // Document list view
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-slide">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            Documents
            {isAdmin && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 font-semibold">
                ALL ACCESS
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {visible.length} document{visible.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 h-10 rounded-xl btn-gold text-sm shadow-lg shadow-[#D4A843]/10">
          <Plus className="h-4 w-4" /> New Document
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-5 anim-slide" style={{ animationDelay: '60ms' }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="input-dark pl-10 h-9 text-sm" />
        </div>

        {/* Department filter — only for admins who see all */}
        {isAdmin && teams.length > 0 && (
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="select-dark h-9 text-xs">
            <option value="all">All Departments</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            <option value="">No Department</option>
          </select>
        )}

        <select value={filterVisibility} onChange={e => setFilterVisibility(e.target.value as any)} className="select-dark h-9 text-xs">
          <option value="all">All Visibility</option>
          <option value="team">Team Only</option>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
        {categories.length > 0 && (
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="select-dark h-9 text-xs">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="select-dark h-9 text-xs">
          <option value="updated">Last Modified</option>
          <option value="created">Newest First</option>
          <option value="title">A → Z</option>
          <option value="wordCount">Word Count</option>
        </select>
        <div className="flex rounded-xl border border-[#1F2937]/60 overflow-hidden">
          <button onClick={() => setView('grid')} className={`px-3 py-1.5 text-xs ${view === 'grid' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600'}`}>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
          </button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs ${view === 'list' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600'}`}>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2.5" rx="0.5" /><rect x="1" y="6.75" width="14" height="2.5" rx="0.5" /><rect x="1" y="11.5" width="14" height="2.5" rx="0.5" /></svg>
          </button>
        </div>
      </div>

      {/* Document Grid/List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-44 skeleton rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-14 w-14 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-sm mb-2">No documents found.</p>
          <button onClick={() => setShowCreate(true)} className="text-sm text-[#D4A843] hover:underline">Create your first document</button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((d, i) => (
            <DocCard key={d.id} doc={d} index={i} teams={teams}
              onClick={() => setActiveDoc(d)}
              onDelete={() => handleDelete(d)}
              onToggleStar={() => handleToggleStar(d)}
              isOwner={d.createdBy === user?.uid || isAdmin}
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
              isOwner={d.createdBy === user?.uid || isAdmin}
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
  const preview = (doc.content || '').replace(/[#*_`>\-\[\]]/g, '').slice(0, 120);
  const updated = doc.updatedAt?.toDate?.();
  const visIcon = doc.visibility === 'private' ? <Lock className="h-3 w-3" /> : doc.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Users className="h-3 w-3" />;
  const visColor = doc.visibility === 'private' ? 'text-red-400' : doc.visibility === 'public' ? 'text-emerald-400' : 'text-blue-400';

  return (
    <div onClick={onClick}
      className="group relative rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5 card-hover cursor-pointer anim-slide overflow-hidden"
      style={{ animationDelay: `${index * 40}ms` }}>
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: team ? `linear-gradient(90deg, ${team.color}60, transparent)` : 'linear-gradient(90deg, rgba(212,168,67,0.4), transparent)' }} />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-[#D4A843]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{doc.title || 'Untitled'}</p>
            {team && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${team.color}15`, color: team.color }}>
                {team.icon} {team.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onToggleStar(); }} className="p-1 rounded-lg hover:bg-white/5 transition">
            {doc.starred ? <Star className="h-3.5 w-3.5 text-[#D4A843] fill-[#D4A843]" /> : <StarOff className="h-3.5 w-3.5 text-gray-700 opacity-0 group-hover:opacity-100" />}
          </button>
          {isOwner && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 rounded-lg hover:bg-red-500/10 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-600 line-clamp-3 mb-4 min-h-[3rem]">{preview || 'Empty document...'}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[10px] ${visColor}`}>{visIcon}{doc.visibility}</span>
          {doc.tags?.slice(0, 2).map((t: string) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1F2937] text-gray-500">{t}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {doc.wordCount > 0 && <span className="text-[10px] text-gray-700">{doc.wordCount}w</span>}
          {updated && <span className="text-[10px] text-gray-700">{updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
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

  return (
    <div onClick={onClick}
      className="group flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-[#1F2937]/60 bg-[#111827] card-hover cursor-pointer anim-slide"
      style={{ animationDelay: `${index * 25}ms` }}>
      <button onClick={e => { e.stopPropagation(); onToggleStar(); }} className="shrink-0">
        {doc.starred ? <Star className="h-4 w-4 text-[#D4A843] fill-[#D4A843]" /> : <StarOff className="h-4 w-4 text-gray-700 opacity-0 group-hover:opacity-100 transition" />}
      </button>
      <div className="w-9 h-9 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-[#D4A843]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{doc.title || 'Untitled'}</p>
        <p className="text-[11px] text-gray-600 truncate">{(doc.content || '').replace(/[#*_`>\-\[\]]/g, '').slice(0, 80) || 'Empty'}</p>
      </div>
      {team && <span className="text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0" style={{ backgroundColor: `${team.color}15`, color: team.color }}>{team.icon} {team.name}</span>}
      <span className={`flex items-center gap-1 text-[10px] shrink-0 ${visColor}`}>{visIcon}</span>
      {doc.wordCount > 0 && <span className="text-[10px] text-gray-600 shrink-0">{doc.wordCount}w</span>}
      {updated && <span className="text-[10px] text-gray-700 shrink-0">{updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
      <span className="text-[10px] text-gray-700 shrink-0">{doc.createdByName}</span>
      {isOwner && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-700 hover:text-red-400 rounded-lg transition shrink-0">
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
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'private' | 'public'>('team');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [deptId, setDeptId] = useState(activeTeamId === '__all__' ? '' : activeTeamId);
  const [template, setTemplate] = useState('blank');

  const templates: { id: string; label: string; content: string }[] = [
    { id: 'blank', label: '📄 Blank', content: '' },
    { id: 'meeting', label: '📋 Meeting Notes', content: '# Meeting Notes\n\n**Date:** \n**Attendees:** \n**Agenda:**\n\n---\n\n## Discussion Points\n\n### Topic 1\n\n\n### Topic 2\n\n\n---\n\n## Action Items\n\n- [ ] \n- [ ] \n\n---\n\n## Next Steps\n\n' },
    { id: 'case', label: '⚖️ Case Summary', content: '# Case Summary\n\n**Case Number:** \n**Client:** \n**Case Type:** \n**Filing Date:** \n**Court:** \n\n---\n\n## Case Overview\n\n\n## Key Facts\n\n\n## Legal Analysis\n\n\n## Strategy\n\n\n## Timeline / Deadlines\n\n| Date | Event | Status |\n|------|-------|--------|\n|      |       |        |\n\n## Notes\n\n' },
    { id: 'sop', label: '📘 SOP', content: '# [Procedure Name]\n\n**Department:** \n**Version:** 1.0\n**Effective Date:** \n\n---\n\n## Purpose\n\n\n## Procedure Steps\n\n### Step 1: \n\n\n### Step 2: \n\n\n### Step 3: \n\n' },
    { id: 'report', label: '📊 Report', content: '# [Report Title]\n\n**Prepared by:** \n**Date:** \n\n---\n\n## Executive Summary\n\n\n## Key Findings\n\n\n## Recommendations\n\n1. \n2. \n3. \n\n## Conclusion\n\n' },
    { id: 'letter', label: '✉️ Client Letter', content: '# Client Letter\n\n**Date:** \n**To:** \n**Re:** \n\n---\n\nDear [Client Name],\n\n\n\nSincerely,\n\n**Law Office of Manuel Solis**\n' },
  ];

  const submit = () => {
    if (!title.trim()) return;
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
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#0C1017] border border-[#1F2937] rounded-2xl shadow-2xl anim-slide overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#1F2937]/60">
          <h2 className="text-lg font-bold text-white">New Document</h2>
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title..."
              autoFocus className="w-full h-12 px-4 rounded-xl bg-[#111827] border border-[#1F2937] text-white text-lg font-semibold placeholder:text-gray-600 focus:outline-none focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30"
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {templates.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)}
                  className={`text-left px-3 py-2.5 rounded-xl text-xs font-medium transition border ${template === t.id ? 'bg-[#D4A843]/10 text-[#D4A843] border-[#D4A843]/20' : 'bg-[#111827] text-gray-500 border-[#1F2937] hover:border-gray-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Department</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className="select-dark w-full">
                <option value="">No Department</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Visibility</label>
              <select value={visibility} onChange={e => setVisibility(e.target.value as any)} className="select-dark w-full">
                <option value="team">🏢 Team</option>
                <option value="private">🔒 Private</option>
                <option value="public">🌐 Public</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Legal, HR..." className="input-dark h-[38px] text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="immigration, filing, urgent" className="input-dark h-9 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-[#1F2937]/60">
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-[#1F2937] text-sm text-gray-400">Cancel</button>
          <button onClick={submit} disabled={!title.trim()} className="px-6 h-10 rounded-xl btn-gold text-sm disabled:opacity-40">Create</button>
        </div>
      </div>
    </div>
  );
}