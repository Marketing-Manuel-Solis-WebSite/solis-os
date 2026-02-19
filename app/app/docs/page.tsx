'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getDocuments, createDocument, updateDocument, deleteDocument, logAction } from '@/lib/db';
import { Plus, Trash2, FileText, Edit2, Check, X, Save } from 'lucide-react';

export default function DocsPage() {
  const { user, me } = useAuth();
  const [docs, setDocs] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false); const [newTitle, setNewTitle] = useState('');
  const [editId, setEditId] = useState<string|null>(null); const [editContent, setEditContent] = useState('');

  const load = async () => { setDocs(await getDocuments()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async () => { if (!newTitle.trim()) return; await createDocument({ title: newTitle.trim() }); await logAction({ action: 'created', resource: 'doc', detail: newTitle, actorId: user!.uid, actorName: me!.displayName }); setNewTitle(''); setShowNew(false); load(); };
  const save = async (id: string) => { await updateDocument(id, { content: editContent }); setEditId(null); load(); };
  const remove = async (d: any) => { if (!confirm(`Delete "${d.title}"?`)) return; await deleteDocument(d.id); await logAction({ action: 'deleted', resource: 'doc', detail: d.title, actorId: user!.uid, actorName: me!.displayName }); load(); };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 anim-slide">
        <div><h1 className="text-2xl font-bold text-white">Documents</h1><p className="text-sm text-gray-500 mt-1">{docs.length} documents</p></div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-5 h-10 rounded-xl btn-gold text-sm"><Plus className="h-4 w-4" /> New Doc</button>
      </div>
      {showNew && (
        <div className="mb-5 p-5 rounded-2xl border border-[#D4A843]/20 bg-[#111827] flex gap-3 anim-fade">
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Document title..." className="input-dark flex-1" onKeyDown={e=>e.key==='Enter'&&add()} autoFocus />
          <button onClick={add} className="px-5 h-[42px] rounded-xl btn-gold text-sm">Create</button>
          <button onClick={()=>setShowNew(false)} className="px-4 h-[42px] rounded-xl border border-[#1F2937] text-sm text-gray-400">Cancel</button>
        </div>
      )}
      {loading ? <div className="space-y-2">{[1,2].map(i=><div key={i} className="h-20 skeleton" />)}</div> :
       docs.length === 0 ? <div className="text-center py-20"><FileText className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-600">No documents yet.</p></div> : (
        <div className="space-y-2">{docs.map((d,i) => (
          <div key={d.id} className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden card-hover anim-slide" style={{animationDelay:`${i*40}ms`}}>
            <div className="flex items-center gap-3 px-5 py-4 group">
              <div className="w-10 h-10 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center"><FileText className="h-5 w-5 text-[#D4A843]" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white">{d.title}</p><p className="text-xs text-gray-600 truncate">{d.content||'Empty document'}</p></div>
              <button onClick={()=>{setEditId(editId===d.id?null:d.id);setEditContent(d.content||'');}} className="p-2 text-gray-600 hover:text-blue-400 rounded-lg transition"><Edit2 className="h-4 w-4" /></button>
              <button onClick={()=>remove(d)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-400 rounded-lg transition"><Trash2 className="h-4 w-4" /></button>
            </div>
            {editId===d.id && (
              <div className="px-5 pb-5 space-y-3 border-t border-[#1F2937]/40 pt-4">
                <textarea value={editContent} onChange={e=>setEditContent(e.target.value)} rows={10} className="w-full input-dark h-auto py-3 resize-y font-mono text-sm" style={{fontFamily:'var(--font-mono, monospace)'}} />
                <div className="flex gap-2">
                  <button onClick={()=>save(d.id)} className="px-4 h-9 rounded-xl btn-gold text-xs flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                  <button onClick={()=>setEditId(null)} className="px-4 h-9 rounded-xl border border-[#1F2937] text-xs text-gray-400">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}</div>
      )}
    </div>
  );
}
