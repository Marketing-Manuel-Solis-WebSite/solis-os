'use client';
import { useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';

export default function AIPage() {
  const [q, setQ] = useState(''); const [a, setA] = useState(''); const [busy, setBusy] = useState(false);
  const ask = async () => {
    if (!q.trim()) return; setBusy(true); setA('');
    try { const r = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({question:q.trim()}) }); const d = await r.json(); setA(d.answer||d.error||'No response'); }
    catch { setA('Error. Check Gemini API key.'); }
    setBusy(false);
  };
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8 anim-slide">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 border border-[#D4A843]/20 flex items-center justify-center shadow-lg shadow-[#D4A843]/10"><Sparkles className="h-6 w-6 text-[#D4A843]" /></div>
        <div><h1 className="text-2xl font-bold text-white">Solis AI</h1><p className="text-sm text-gray-500">Powered by Gemini — ask anything</p></div>
      </div>
      <div className="flex gap-3 mb-6 anim-slide" style={{animationDelay:'60ms'}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask Solis AI a question..." className="input-dark flex-1 h-12 text-base" onKeyDown={e=>e.key==='Enter'&&ask()} />
        <button onClick={ask} disabled={busy} className="h-12 px-6 rounded-xl btn-gold text-sm flex items-center gap-2 disabled:opacity-50"><Send className="h-4 w-4" /> {busy?'...':'Ask'}</button>
      </div>
      {a && (
        <div className="rounded-2xl border border-[#D4A843]/20 bg-[#111827] p-6 anim-fade" style={{boxShadow:'0 0 40px rgba(212,168,67,0.03)'}}>
          <div className="flex items-center gap-2 mb-4"><Bot className="h-4 w-4 text-[#D4A843]" /><span className="text-sm font-semibold text-[#D4A843]">Solis AI</span></div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}
