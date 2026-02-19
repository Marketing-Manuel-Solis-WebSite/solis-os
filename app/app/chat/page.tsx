'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getChannels, createChannel, getMessages, sendMessage } from '@/lib/db';
import { Plus, Send, Hash, MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const { user, me } = useAuth();
  const [channels, setChannels] = useState<any[]>([]); const [active, setActive] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]); const [txt, setTxt] = useState('');
  const [newName, setNewName] = useState(''); const [showNew, setShowNew] = useState(false);

  const loadCh = async () => { const c = await getChannels(); setChannels(c); if (c.length && !active) setActive(c[0]); };
  useEffect(() => { loadCh(); }, []);
  useEffect(() => { if (active) getMessages(active.id).then(setMsgs); }, [active]);

  const send = async () => { if (!txt.trim()||!active) return; await sendMessage(active.id, { content: txt.trim(), userId: user!.uid, displayName: me!.displayName }); setTxt(''); setMsgs(await getMessages(active.id)); };
  const addCh = async () => { if (!newName.trim()) return; await createChannel({ name: newName.trim() }); setNewName(''); setShowNew(false); loadCh(); };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <aside className="w-56 bg-[#0C1017] border-r border-[#1F2937]/60 flex flex-col shrink-0">
        <div className="p-3 border-b border-[#1F2937]/60 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Channels</span>
          <button onClick={()=>setShowNew(!showNew)} className="p-1.5 rounded-lg text-gray-600 hover:text-[#D4A843] hover:bg-[#D4A843]/10 transition"><Plus className="h-4 w-4" /></button>
        </div>
        {showNew && <div className="p-2 border-b border-[#1F2937]/40 flex gap-1"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Channel" className="input-dark flex-1 h-8 text-xs" onKeyDown={e=>e.key==='Enter'&&addCh()} /><button onClick={addCh} className="h-8 px-3 rounded-lg btn-gold text-xs">+</button></div>}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {channels.map(ch => (
            <button key={ch.id} onClick={()=>setActive(ch)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition ${active?.id===ch.id?'bg-[#D4A843]/10 text-[#D4A843] font-semibold':'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`}>
              <Hash className="h-3.5 w-3.5 shrink-0" /> {ch.name}
            </button>
          ))}
          {!channels.length && <p className="text-xs text-gray-700 text-center py-6">Create a channel</p>}
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        {active ? (<>
          <div className="h-14 border-b border-[#1F2937]/60 glass flex items-center px-5 gap-2"><Hash className="h-4 w-4 text-[#D4A843]" /><span className="font-semibold text-white text-sm">{active.name}</span></div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!msgs.length && <p className="text-center text-gray-700 text-sm py-10">Start the conversation!</p>}
            {msgs.map(m => (
              <div key={m.id} className="flex gap-3 anim-fade">
                <div className="w-9 h-9 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-xs font-bold text-[#D4A843] shrink-0">{(m.displayName||'?')[0].toUpperCase()}</div>
                <div><div className="flex items-baseline gap-2"><span className="text-sm font-semibold text-white">{m.displayName}</span><span className="text-[10px] text-gray-700">{m.createdAt?.toDate?.()?.toLocaleTimeString?.() || ''}</span></div><p className="text-sm text-gray-300 mt-0.5">{m.content}</p></div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-[#1F2937]/60 bg-[#0C1017]">
            <div className="flex gap-2"><input value={txt} onChange={e=>setTxt(e.target.value)} placeholder={`Message #${active.name}...`} className="input-dark flex-1" onKeyDown={e=>e.key==='Enter'&&send()} /><button onClick={send} className="h-[42px] px-5 rounded-xl btn-gold"><Send className="h-4 w-4" /></button></div>
          </div>
        </>) : (
          <div className="flex-1 flex items-center justify-center"><div className="text-center"><MessageSquare className="h-14 w-14 text-gray-800 mx-auto mb-4" /><p className="text-gray-600">Select or create a channel</p></div></div>
        )}
      </div>
    </div>
  );
}
