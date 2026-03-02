'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getAIConversations, createAIConversation, deleteAIConversation,
  updateAIConversation, getAIMessages, addAIMessage,
  autoTitleConversation, AIConversation, AIMessage,
} from '@/lib/ai-db';
import AISidebar from '@/components/ai/ai-sidebar';
import AIMessages from '@/components/ai/ai-messages';
import AIInput from '@/components/ai/ai-input';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function AIPage() {
  const { user, me } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const skipNextFetch = useRef(false);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const convos = await getAIConversations(user.uid);
    setConversations(convos.filter(c => !c.archived));
    setLoadingConvos(false);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!activeConvo) { setMessages([]); return; }
    if (skipNextFetch.current) { skipNextFetch.current = false; return; }
    (async () => {
      const msgs = await getAIMessages(activeConvo.id);
      setMessages(msgs);
    })();
  }, [activeConvo?.id]);

  const handleNewChat = async () => {
    if (!user || !me) return;
    const id = await createAIConversation({ userId: user.uid, userName: me.displayName, title: 'New conversation', mode: 'chat' });
    const convos = await getAIConversations(user.uid);
    setConversations(convos.filter(c => !c.archived));
    const newConvo = convos.find(c => c.id === id);
    if (newConvo) {
      skipNextFetch.current = true;
      setActiveConvo(newConvo);
    }
    setMessages([]);
  };

  const handleSend = async (content: string) => {
    if (!user || !me || !content.trim() || loading) return;
    let convoId = activeConvo?.id;

    if (!convoId) {
      convoId = await createAIConversation({ userId: user.uid, userName: me.displayName, title: 'New conversation', mode: 'chat' });
      const convos = await getAIConversations(user.uid);
      setConversations(convos.filter(c => !c.archived));
      const newConvo = convos.find(c => c.id === convoId);
      if (newConvo) {
        skipNextFetch.current = true;
        setActiveConvo(newConvo);
      }
    }

    await addAIMessage(convoId, { role: 'user', content: content.trim(), mode: 'chat' });
    if (messages.length === 0) await autoTitleConversation(convoId, content.trim());

    const userMsg: AIMessage = { id: `temp-${Date.now()}`, role: 'user', content: content.trim(), mode: 'chat', tokens: 0, createdAt: { seconds: Date.now() / 1000 } };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamingText('');

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: content.trim(), mode: 'chat', history }) });
      const data = await res.json();
      const answer = data.answer || data.error || 'No response from AI.';

      await addAIMessage(convoId, { role: 'assistant', content: answer, mode: 'chat', tokens: data.tokens || 0 });

      // Stream word by word
      const words = answer.split(' ');
      let accumulated = '';
      for (let i = 0; i < words.length; i++) {
        accumulated += (i === 0 ? '' : ' ') + words[i];
        setStreamingText(accumulated);
        const delay = words.length > 200 ? 5 : words.length > 100 ? 10 : 20;
        await new Promise(r => setTimeout(r, delay));
      }
      setStreamingText('');

      const aiMsg: AIMessage = { id: `temp-ai-${Date.now()}`, role: 'assistant', content: answer, mode: 'chat', tokens: data.tokens || 0, createdAt: { seconds: Date.now() / 1000 } };
      setMessages(prev => [...prev, aiMsg]);
      await loadConversations();
    } catch (err: any) {
      setStreamingText('');
      const errorMsg: AIMessage = { id: `temp-err-${Date.now()}`, role: 'assistant', content: `Error: ${err.message || 'Failed to connect to AI.'}`, mode: 'chat', tokens: 0, createdAt: { seconds: Date.now() / 1000 } };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConvo = async (id: string) => {
    if (!confirm('Delete this conversation?')) return;
    await deleteAIConversation(id);
    if (activeConvo?.id === id) { setActiveConvo(null); setMessages([]); }
    loadConversations();
  };

  const handleRenameConvo = async (id: string, title: string) => {
    await updateAIConversation(id, { title });
    loadConversations();
    if (activeConvo?.id === id) setActiveConvo({ ...activeConvo, title } as AIConversation);
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {sidebarOpen && (
        <AISidebar
          conversations={conversations} activeId={activeConvo?.id || null} loading={loadingConvos}
          onSelect={setActiveConvo} onNew={handleNewChat}
          onDelete={handleDeleteConvo} onRename={handleRenameConvo}
          onToggle={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-base)]">
        {/* Header */}
        <div className="h-12 flex items-center px-4 shrink-0 bg-[var(--bg-base)]">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition mr-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {activeConvo?.title && activeConvo.title !== 'New conversation' ? activeConvo.title : 'Solis AI'}
            </span>
          </div>
        </div>

        {!activeConvo && messages.length === 0 ? (
          <WelcomeScreen onQuickStart={handleSend} />
        ) : (
          <AIMessages messages={messages} loading={loading} streamingText={streamingText} />
        )}

        <AIInput loading={loading} onSend={handleSend} />
      </div>
    </div>
  );
}

function WelcomeScreen({ onQuickStart }: { onQuickStart: (question: string) => void }) {
  const SUGGESTIONS = [
    { icon: '💬', title: 'Redactar un correo profesional', question: 'Ayudame a redactar un correo profesional para un cliente informandole del estatus de su caso' },
    { icon: '📋', title: 'Checklist de documentos', question: 'Dame un checklist completo de documentos necesarios para abrir un caso nuevo' },
    { icon: '🔍', title: 'Investigar un tema legal', question: 'Investiga los cambios mas recientes en las politicas de USCIS para visas de trabajo' },
    { icon: '📊', title: 'Crear un reporte', question: 'Genera un reporte sobre las mejores estrategias de marketing digital para bufetes de abogados' },
  ];

  return (
    <div className="flex-1 flex items-center justify-center overflow-y-auto">
      <div className="max-w-2xl w-full px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-16 h-16 mx-auto mb-5 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/20"
          >
            <Sparkles className="h-8 w-8 text-[var(--accent-text)]" />
          </motion.div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1.5">How can I help you today?</h1>
          <p className="text-base text-[var(--text-muted)]">Ask me anything about legal research, documents, or business operations.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="grid grid-cols-2 gap-3">
          {SUGGESTIONS.map((s, i) => (
            <motion.button key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickStart(s.question)}
              className="flex items-start gap-3 p-4 rounded-lg bg-[var(--bg-elevated)] text-left transition-all group hover:bg-[var(--bg-elevated)]"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{s.title}</p>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{s.question}</p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
