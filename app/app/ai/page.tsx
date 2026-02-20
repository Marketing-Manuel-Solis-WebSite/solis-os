'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getAIConversations, createAIConversation, deleteAIConversation,
  updateAIConversation, starAIConversation, getAIMessages, addAIMessage,
  autoTitleConversation, AIConversation, AIMessage, AIMode,
} from '@/lib/ai-db';
import AISidebar from '@/components/ai/ai-sidebar';
import AIMessages from '@/components/ai/ai-messages';
import AIInput from '@/components/ai/ai-input';
import { Sparkles, Bot, Zap, Globe, FileSearch, MessageSquare } from 'lucide-react';

const MODE_CONFIG: Record<AIMode, { label: string; icon: any; color: string; description: string; badge: string }> = {
  chat: { label: 'Chat', icon: MessageSquare, color: '#D4A843', description: 'Quick conversations — fast and direct answers', badge: 'FAST' },
  research: { label: 'Investigar', icon: Globe, color: '#3B82F6', description: 'Research mode — detailed, sourced analysis on any topic', badge: 'RESEARCH' },
  deep: { label: 'Deep Search', icon: FileSearch, color: '#A855F7', description: 'Full report generation — publication-quality research documents', badge: 'REPORT' },
};

export default function AIPage() {
  const { user, me } = useAuth();

  // State
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [mode, setMode] = useState<AIMode>('chat');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [streamingText, setStreamingText] = useState('');

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const convos = await getAIConversations(user.uid);
    setConversations(convos.filter(c => !c.archived));
    setLoadingConvos(false);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvo) { setMessages([]); return; }
    (async () => {
      const msgs = await getAIMessages(activeConvo.id);
      setMessages(msgs);
      setMode(activeConvo.mode || 'chat');
    })();
  }, [activeConvo?.id]);

  // Create new conversation
  const handleNewChat = async (initialMode?: AIMode) => {
    if (!user || !me) return;
    const m = initialMode || mode;
    const id = await createAIConversation({
      userId: user.uid,
      userName: me.displayName,
      title: 'New conversation',
      mode: m,
    });
    setMode(m);
    const convos = await getAIConversations(user.uid);
    setConversations(convos.filter(c => !c.archived));
    const newConvo = convos.find(c => c.id === id);
    if (newConvo) setActiveConvo(newConvo);
    setMessages([]);
  };

  // Send message
  const handleSend = async (content: string, sendMode?: AIMode) => {
    if (!user || !me || !content.trim() || loading) return;

    const currentMode = sendMode || mode;
    let convoId = activeConvo?.id;

    // Auto-create conversation if none active
    if (!convoId) {
      convoId = await createAIConversation({
        userId: user.uid,
        userName: me.displayName,
        title: 'New conversation',
        mode: currentMode,
      });
      const convos = await getAIConversations(user.uid);
      setConversations(convos.filter(c => !c.archived));
      const newConvo = convos.find(c => c.id === convoId);
      if (newConvo) setActiveConvo(newConvo);
    }

    // Save user message
    await addAIMessage(convoId, {
      role: 'user',
      content: content.trim(),
      mode: currentMode,
    });

    // Auto-title on first message
    if (messages.length === 0) {
      await autoTitleConversation(convoId, content.trim());
    }

    // Update local messages immediately
    const userMsg: AIMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      mode: currentMode,
      tokens: 0,
      createdAt: { seconds: Date.now() / 1000 },
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamingText('');

    try {
      // Build history for API
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: content.trim(),
          mode: currentMode,
          history,
        }),
      });

      const data = await res.json();
      const answer = data.answer || data.error || 'No response from AI.';

      // Save AI response to Firestore
      await addAIMessage(convoId, {
        role: 'assistant',
        content: answer,
        mode: currentMode,
        tokens: data.tokens || 0,
      });

      // Simulate streaming effect
      const words = answer.split(' ');
      let accumulated = '';
      for (let i = 0; i < words.length; i++) {
        accumulated += (i === 0 ? '' : ' ') + words[i];
        setStreamingText(accumulated);
        // Variable speed: faster for long responses
        const delay = words.length > 200 ? 5 : words.length > 100 ? 10 : 20;
        await new Promise(r => setTimeout(r, delay));
      }
      setStreamingText('');

      // Add final message
      const aiMsg: AIMessage = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: answer,
        mode: currentMode,
        tokens: data.tokens || 0,
        createdAt: { seconds: Date.now() / 1000 },
      };
      setMessages(prev => [...prev, aiMsg]);

      // Refresh conversation list
      await loadConversations();
    } catch (err: any) {
      const errorMsg: AIMessage = {
        id: `temp-err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to connect to AI. Check your GEMINI_API_KEY.'}`,
        mode: currentMode,
        tokens: 0,
        createdAt: { seconds: Date.now() / 1000 },
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    setLoading(false);
  };

  // Delete conversation
  const handleDeleteConvo = async (id: string) => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    await deleteAIConversation(id);
    if (activeConvo?.id === id) {
      setActiveConvo(null);
      setMessages([]);
    }
    loadConversations();
  };

  // Star conversation
  const handleStarConvo = async (id: string) => {
    const convo = conversations.find(c => c.id === id);
    if (!convo) return;
    await starAIConversation(id, !convo.starred);
    loadConversations();
    if (activeConvo?.id === id) {
      setActiveConvo({ ...activeConvo, starred: !convo.starred });
    }
  };

  // Rename conversation
  const handleRenameConvo = async (id: string, title: string) => {
    await updateAIConversation(id, { title });
    loadConversations();
    if (activeConvo?.id === id) {
      setActiveConvo({ ...activeConvo, title } as AIConversation);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      {sidebarOpen && (
        <AISidebar
          conversations={conversations}
          activeId={activeConvo?.id || null}
          loading={loadingConvos}
          onSelect={(convo) => setActiveConvo(convo)}
          onNew={() => handleNewChat()}
          onNewWithMode={(m) => handleNewChat(m)}
          onDelete={handleDeleteConvo}
          onStar={handleStarConvo}
          onRename={handleRenameConvo}
          onToggle={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#06080F]">
        {/* Mode selector / Header */}
        <div className="h-14 border-b border-[#1F2937]/60 glass flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg mr-1" title="Show sidebar">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 border border-[#D4A843]/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-[#D4A843]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Solis AI</p>
                <p className="text-[10px] text-gray-600">{activeConvo?.title || 'New conversation'}</p>
              </div>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0C1017] border border-[#1F2937]/60">
            {(Object.entries(MODE_CONFIG) as [AIMode, typeof MODE_CONFIG['chat']][]).map(([m, config]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition ${
                  mode === m
                    ? `text-white`
                    : 'text-gray-600 hover:text-gray-400'
                }`}
                style={mode === m ? { backgroundColor: `${config.color}15`, color: config.color } : {}}>
                <config.icon className="h-3.5 w-3.5" />
                {config.label}
                {mode === m && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-md font-bold" style={{ backgroundColor: `${config.color}20` }}>
                    {config.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Messages area */}
        {!activeConvo && messages.length === 0 ? (
          <WelcomeScreen mode={mode} setMode={setMode} onQuickStart={(q, m) => { setMode(m); handleSend(q, m); }} />
        ) : (
          <AIMessages
            messages={messages}
            loading={loading}
            streamingText={streamingText}
            mode={mode}
            userId={user?.uid || ''}
          />
        )}

        {/* Input */}
        <AIInput
          mode={mode}
          loading={loading}
          onSend={handleSend}
          onModeChange={setMode}
        />
      </div>
    </div>
  );
}

// ========== WELCOME SCREEN ==========
function WelcomeScreen({ mode, setMode, onQuickStart }: {
  mode: AIMode;
  setMode: (m: AIMode) => void;
  onQuickStart: (question: string, mode: AIMode) => void;
}) {
  const SUGGESTIONS: { mode: AIMode; icon: string; title: string; question: string }[] = [
    { mode: 'chat', icon: '💬', title: 'Redactar un correo profesional', question: 'Ayúdame a redactar un correo profesional para un cliente informándole del estatus de su caso de inmigración' },
    { mode: 'chat', icon: '📋', title: 'Checklist para caso nuevo', question: 'Dame un checklist completo de documentos necesarios para abrir un caso de asilo político' },
    { mode: 'research', icon: '🔍', title: 'Investigar cambios en USCIS', question: 'Investiga los cambios más recientes en las políticas de USCIS para visas de trabajo H-1B y cómo afectan a nuestros clientes' },
    { mode: 'research', icon: '📊', title: 'Análisis de estrategia marketing', question: 'Analiza las mejores estrategias de marketing digital para bufetes de abogados de inmigración en Estados Unidos' },
    { mode: 'deep', icon: '📑', title: 'Reporte: Proceso de asilo completo', question: 'Genera un reporte completo y detallado sobre el proceso de asilo en Estados Unidos: requisitos, pasos, tiempos, costos, tasas de aprobación, y mejores prácticas para abogados' },
    { mode: 'deep', icon: '📈', title: 'Reporte: KPIs para bufete', question: 'Genera un reporte ejecutivo sobre los KPIs más importantes para medir el rendimiento de un bufete de abogados de inmigración, incluyendo métricas de marketing, ventas, operaciones y satisfacción del cliente' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-10 anim-slide">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 border border-[#D4A843]/20 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-[#D4A843]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Solis AI</h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Your intelligent assistant for legal research, document drafting, case analysis, and business operations.
          </p>
        </div>

        {/* Mode cards */}
        <div className="grid grid-cols-3 gap-3 mb-10 anim-slide" style={{ animationDelay: '60ms' }}>
          {(Object.entries(MODE_CONFIG) as [AIMode, typeof MODE_CONFIG['chat']][]).map(([m, config]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`p-4 rounded-2xl border text-left transition group ${
                mode === m
                  ? 'border-opacity-30 bg-opacity-5'
                  : 'border-[#1F2937]/60 bg-[#111827] hover:border-gray-600'
              }`}
              style={mode === m ? { borderColor: config.color, backgroundColor: `${config.color}08` } : {}}>
              <div className="flex items-center gap-2 mb-2">
                <config.icon className="h-5 w-5" style={{ color: config.color }} />
                <span className="text-sm font-bold" style={{ color: mode === m ? config.color : '#fff' }}>{config.label}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-md font-bold ml-auto" style={{ backgroundColor: `${config.color}15`, color: config.color }}>{config.badge}</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{config.description}</p>
            </button>
          ))}
        </div>

        {/* Suggestions */}
        <div className="anim-slide" style={{ animationDelay: '120ms' }}>
          <p className="text-[10px] text-gray-600 uppercase font-semibold tracking-wider mb-3">Quick Start</p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.map((s, i) => {
              const config = MODE_CONFIG[s.mode];
              return (
                <button key={i} onClick={() => onQuickStart(s.question, s.mode)}
                  className="flex items-start gap-3 p-4 rounded-2xl border border-[#1F2937]/60 bg-[#111827] hover:border-gray-600 text-left transition group card-hover">
                  <span className="text-xl shrink-0">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-300 group-hover:text-white transition">{s.title}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{s.question}</p>
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-md font-bold shrink-0 mt-0.5" style={{ backgroundColor: `${config.color}15`, color: config.color }}>
                    {config.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Capabilities */}
        <div className="mt-10 grid grid-cols-4 gap-4 anim-slide" style={{ animationDelay: '180ms' }}>
          {[
            { icon: '⚖️', label: 'Legal Research' },
            { icon: '📝', label: 'Document Drafting' },
            { icon: '🌐', label: 'English & Spanish' },
            { icon: '📊', label: 'Reports & Analysis' },
          ].map(cap => (
            <div key={cap.label} className="text-center p-3 rounded-xl bg-[#111827]/50 border border-[#1F2937]/30">
              <span className="text-lg">{cap.icon}</span>
              <p className="text-[10px] text-gray-600 mt-1">{cap.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}