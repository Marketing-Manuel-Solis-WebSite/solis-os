'use client';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getAIConversations, createAIConversation, deleteAIConversation,
  updateAIConversation, getAIMessages, addAIMessage,
  autoTitleConversation, AIConversation, AIMessage,
} from '@/lib/ai-db';
import { getTasks, getGoals } from '@/lib/db';
import AISidebar from '@/components/ai/ai-sidebar';
import AIMessages from '@/components/ai/ai-messages';
import AIInput from '@/components/ai/ai-input';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, PanelLeftOpen } from 'lucide-react';

export default function AIPage() {
  const { user, me, teams } = useAuth();
  const { t } = useI18n();
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
    const id = await createAIConversation({ userId: user.uid, userName: me.displayName, title: t('ai.newConversation'), mode: 'chat' });
    const convos = await getAIConversations(user.uid);
    setConversations(convos.filter(c => !c.archived));
    const newConvo = convos.find(c => c.id === id);
    if (newConvo) {
      skipNextFetch.current = true;
      setActiveConvo(newConvo);
    }
    setMessages([]);
  };

  // Build real workspace context for AI
  const buildUserContext = useCallback(async () => {
    if (!user || !me) return null;
    try {
      const [allTasks, allGoals] = await Promise.all([getTasks(), getGoals()]);
      // Filter tasks assigned to this user
      const myTasks = allTasks.filter((t: any) =>
        t.assignees?.includes(user.uid) && !t.deleted && !t.archived
      ).map((t: any) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate || null,
        teamId: t.teamId,
      }));
      // Filter goals owned by this user or their team
      const myGoals = allGoals.filter((g: any) =>
        g.ownerId === user.uid || g.teamId === me.teamId
      ).map((g: any) => ({
        name: g.name,
        status: g.status,
        progress: g.progress,
        dueDate: g.dueDate || null,
      }));
      const myTeam = teams.find((t: any) => t.id === me.teamId);
      return {
        userName: me.displayName,
        userRole: me.role,
        teamName: myTeam?.name || me.teamId || 'Sin equipo',
        tasks: myTasks,
        goals: myGoals,
      };
    } catch { return null; }
  }, [user, me, teams]);

  const handleSend = async (content: string, sendMode: string = 'chat') => {
    if (!user || !me || !content.trim() || loading) return;
    const aiMode = sendMode as 'chat' | 'research' | 'deep';
    let convoId = activeConvo?.id;

    if (!convoId) {
      convoId = await createAIConversation({ userId: user.uid, userName: me.displayName, title: t('ai.newConversation'), mode: aiMode });
      const convos = await getAIConversations(user.uid);
      setConversations(convos.filter(c => !c.archived));
      const newConvo = convos.find(c => c.id === convoId);
      if (newConvo) {
        skipNextFetch.current = true;
        setActiveConvo(newConvo);
      }
    }

    await addAIMessage(convoId, { role: 'user', content: content.trim(), mode: aiMode });
    if (messages.length === 0) await autoTitleConversation(convoId, content.trim());

    const userMsg: AIMessage = { id: `temp-${Date.now()}`, role: 'user', content: content.trim(), mode: aiMode, tokens: 0, createdAt: { seconds: Date.now() / 1000 } };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamingText('');

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const userContext = await buildUserContext();

      // Use real SSE streaming
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ question: content.trim(), mode: aiMode, history, stream: true, userContext }),
      });

      if (res.status === 429) {
        throw new Error(t('ai.rateLimitError'));
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('ai.noResponse'));
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.done) {
              tokenCount = data.tokens || 0;
            } else if (data.text) {
              fullAnswer += data.text;
              setStreamingText(fullAnswer);
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
          }
        }
      }

      setStreamingText('');
      const answer = fullAnswer || t('ai.noResponse');

      await addAIMessage(convoId, { role: 'assistant', content: answer, mode: aiMode, tokens: tokenCount });

      const aiMsg: AIMessage = { id: `temp-ai-${Date.now()}`, role: 'assistant', content: answer, mode: aiMode, tokens: tokenCount, createdAt: { seconds: Date.now() / 1000 } };
      setMessages(prev => [...prev, aiMsg]);
      await loadConversations();
    } catch (err: any) {
      setStreamingText('');
      const errorMsg: AIMessage = { id: `temp-err-${Date.now()}`, role: 'assistant', content: `Error: ${err.message || 'Failed to connect to AI.'}`, mode: aiMode, tokens: 0, createdAt: { seconds: Date.now() / 1000 } };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConvo = async (id: string) => {
    if (!confirm(t('ai.deleteConfirm'))) return;
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
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden shrink-0"
          >
            <AISidebar
              conversations={conversations} activeId={activeConvo?.id || null} loading={loadingConvos}
              onSelect={setActiveConvo} onNew={handleNewChat}
              onDelete={handleDeleteConvo} onRename={handleRenameConvo}
              onToggle={() => setSidebarOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-base)]">
        {/* Header */}
        <header className="h-14 flex items-center px-4 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <motion.button
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </motion.button>
            )}
            <div className="min-w-0">
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate block">
                {activeConvo?.title && activeConvo.title !== t('ai.newConversation') ? activeConvo.title : 'Solis AI'}
              </span>
            </div>
          </div>
        </header>

        {/* Chat or Welcome */}
        {!activeConvo && messages.length === 0 ? (
          <WelcomeScreen onQuickStart={handleSend} userName={me?.displayName?.split(' ')[0] || ''} />
        ) : (
          <AIMessages messages={messages} loading={loading} streamingText={streamingText} userPhoto={me?.photoURL} userName={me?.displayName} />
        )}

        <AIInput loading={loading} onSend={handleSend} />
      </div>
    </div>
  );
}

// =====================================================
// WELCOME SCREEN
// =====================================================
const PHRASE_COUNT = 20;

function getTimeGreeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t('ai.goodMorning');
  if (h >= 12 && h < 19) return t('ai.goodAfternoon');
  return t('ai.goodEvening');
}

function WelcomeScreen({ onQuickStart, userName }: { onQuickStart: (question: string) => void; userName: string }) {
  const { t } = useI18n();
  // -1 = time greeting, 0..19 = rotating phrases
  const [phraseIdx, setPhraseIdx] = useState(-1);

  const SUGGESTIONS = [
    { title: t('ai.draftEmail'), question: t('ai.draftEmailQ') },
    { title: t('ai.docChecklist'), question: t('ai.docChecklistQ') },
    { title: t('ai.researchLegal'), question: t('ai.researchLegalQ') },
    { title: t('ai.createReport'), question: t('ai.createReportQ') },
  ];

  // Shuffle order for phrases so it feels random each visit
  const [shuffled] = useState(() => {
    const arr = Array.from({ length: PHRASE_COUNT }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  useEffect(() => {
    // Show greeting for 5 seconds, then rotate every 4 seconds
    const firstTimer = setTimeout(() => {
      setPhraseIdx(0);
    }, 5000);

    const interval = setInterval(() => {
      setPhraseIdx(prev => (prev < 0 ? 0 : (prev + 1) % PHRASE_COUNT));
    }, 4000);

    // Clear the first timer once it fires, keep interval
    return () => { clearTimeout(firstTimer); clearInterval(interval); };
  }, []);

  const currentPhrase = phraseIdx < 0
    ? getTimeGreeting(t)
    : t(`ai.phrase.${shuffled[phraseIdx]}`);

  return (
    <div className="flex-1 flex items-center justify-center overflow-y-auto">
      <div className="max-w-2xl w-full px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[#5B8DEF] flex items-center justify-center shadow-lg"
          >
            <Sparkles className="h-7 w-7 text-white" />
          </motion.div>

          {/* Dynamic greeting */}
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2 min-h-[36px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={phraseIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="inline-block"
              >
                {currentPhrase}
                {userName ? `, ${userName}` : ''}
              </motion.span>
            </AnimatePresence>
          </h1>
          <p className="text-base text-[var(--text-muted)]">{t('ai.askAnything')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {SUGGESTIONS.map((s, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickStart(s.question)}
              className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-left transition-all group hover:border-[var(--accent)]/30 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  {s.title}
                </p>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
                  {s.question}
                </p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
