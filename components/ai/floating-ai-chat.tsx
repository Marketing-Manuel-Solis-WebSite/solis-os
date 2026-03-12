'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { useI18n } from '@/lib/i18n';
import { usePathname, useRouter } from 'next/navigation';
import { getTasks, getGoals } from '@/lib/db';
import { checkAIUsage, incrementAIUsage, logAIAction } from '@/lib/ai-usage';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowUp, Loader2, Maximize2 } from 'lucide-react';
import AIMarkdown from './ai-markdown';

interface MiniMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function FloatingAIChat() {
  const { user, me, teams } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<MiniMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isAIPage = pathname === '/app/ai';

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages.length, streamingText]);

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const buildUserContext = useCallback(async () => {
    if (!user || !me) return null;
    try {
      const [{ items: allTasks }, { items: allGoals }] = await Promise.all([getTasks(), getGoals()]);
      const myTasks = allTasks.filter((t: any) =>
        t.assignees?.includes(user.uid) && !t.deleted && !t.archived
      ).map((t: any) => ({
        title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate || null,
      }));
      const myGoals = allGoals.filter((g: any) =>
        g.ownerId === user.uid || g.teamId === me.teamId
      ).map((g: any) => ({
        name: g.name, status: g.status, progress: g.progress, dueDate: g.dueDate || null,
      }));
      const myTeam = teams.find((t: any) => t.id === me.teamId);
      return {
        userName: me.displayName,
        userRole: me.role,
        teamName: myTeam?.name || me.teamId || '',
        tasks: myTasks,
        goals: myGoals,
      };
    } catch (err) { console.error('[FloatingAIChat] build context failed:', err); return null; }
  }, [user, me, teams]);

  // Don't render on the full AI page
  if (isAIPage) return null;

  const handleSend = async () => {
    if (!text.trim() || loading || !user || !me) return;
    const question = text.trim();
    setText('');

    // Check AI usage limits
    try {
      const usage = await checkAIUsage(user.uid, me.role || 'member', 'chat');
      if (!usage.allowed) {
        const limitMsg: MiniMessage = { id: `l-${Date.now()}`, role: 'assistant', content: `Limite diario alcanzado (${usage.used}/${usage.limit} unidades).` };
        setMessages(prev => [...prev, limitMsg]);
        return;
      }
    } catch {}

    const userMsg: MiniMessage = { id: `u-${Date.now()}`, role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamingText('');
    const start = Date.now();

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const userContext = await buildUserContext();

      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ question, mode: 'chat', history, stream: true, userContext, feature: 'floating' }),
      });

      if (res.status === 429) {
        throw new Error('Limite de API excedido. Espera un minuto.');
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        const code = data.code || '';
        let errorText = data.error || 'Error';
        if (code === 'TIMEOUT') errorText = 'Consulta demasiado larga. Intenta algo mas corto.';
        else if (code === 'AUTH_FAILED') errorText = 'Error de autenticacion AI. Contacta al admin.';
        throw new Error(errorText);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.text) {
              fullAnswer += data.text;
              setStreamingText(fullAnswer);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      setStreamingText('');
      const durationMs = Date.now() - start;
      const answer = fullAnswer || 'Sin respuesta.';
      const aiMsg: MiniMessage = { id: `a-${Date.now()}`, role: 'assistant', content: answer };
      setMessages(prev => [...prev, aiMsg]);

      // Track usage + log
      const estimatedTokens = Math.ceil(answer.length / 4);
      incrementAIUsage(user.uid, 'chat', estimatedTokens).catch(() => {});
      logAIAction({
        userId: user.uid, userName: me.displayName || '', feature: 'floating', mode: 'chat',
        questionLength: question.length, contextLength: 0, responseLength: answer.length,
        truncated: false, durationMs, success: true, estimatedTokens,
      }).catch(() => {});
    } catch (err: any) {
      setStreamingText('');
      const errMsg: MiniMessage = { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${err.message}` };
      setMessages(prev => [...prev, errMsg]);

      logAIAction({
        userId: user.uid, userName: me.displayName || '', feature: 'floating', mode: 'chat',
        questionLength: question.length, contextLength: 0, responseLength: 0,
        truncated: false, durationMs: Date.now() - start, success: false,
        error: err.message, estimatedTokens: 0,
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = text.trim().length > 0 && !loading;

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => setOpen(true)}
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 50,
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: 'none',
              boxShadow: 'var(--shadow-lg)',
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Sparkles style={{ width: 20, height: 20, color: 'var(--bg-base)' }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 50,
              width: 400, maxHeight: 520,
              borderRadius: 16, overflow: 'hidden',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles style={{ width: 14, height: 14, color: 'var(--bg-base)' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('ai.miniChat')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => { setOpen(false); router.push('/app/ai'); }}
                  title={t('ai.openFullChat')}
                  style={{
                    padding: 6, borderRadius: 8, cursor: 'pointer',
                    background: 'none', border: 'none',
                    color: 'var(--text-muted)', display: 'flex',
                  }}
                  className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <Maximize2 style={{ width: 15, height: 15 }} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: 6, borderRadius: 8, cursor: 'pointer',
                    background: 'none', border: 'none',
                    color: 'var(--text-muted)', display: 'flex',
                  }}
                  className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              style={{
                flex: 1, overflowY: 'auto', padding: '16px 14px',
                display: 'flex', flexDirection: 'column', gap: 16,
                minHeight: 200, maxHeight: 360,
              }}
            >
              {messages.length === 0 && !loading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                    {t('ai.askAnything')}
                  </p>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  {msg.role === 'user' ? (
                    <div style={{
                      maxWidth: '85%', padding: '10px 14px', borderRadius: '14px 14px 4px 14px',
                      background: 'var(--text-primary)', color: 'var(--bg-base)',
                      fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div className="ai-response-bubble" style={{
                      maxWidth: '90%', padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                      fontSize: 13, lineHeight: 1.5,
                    }}>
                      <AIMarkdown content={msg.content} />
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming */}
              {loading && streamingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div className="ai-response-bubble" style={{
                    maxWidth: '90%', padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    <AIMarkdown content={streamingText} />
                  </div>
                </div>
              )}

              {/* Thinking */}
              {loading && !streamingText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('ai.thinking')}</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{
              padding: '10px 12px', borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 8,
                background: 'var(--bg-base)', borderRadius: 12,
                border: '1px solid var(--border)', padding: '4px 4px 4px 12px',
              }}>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('ai.floatingPlaceholder')}
                  rows={1}
                  disabled={loading}
                  style={{
                    flex: 1, minWidth: 0, padding: '6px 0',
                    background: 'transparent', border: 'none', outline: 'none',
                    resize: 'none', fontSize: 13, lineHeight: 1.5,
                    color: 'var(--text-primary)', maxHeight: 80,
                    fontFamily: 'inherit',
                  }}
                />
                <motion.button
                  whileHover={canSend ? { scale: 1.05 } : {}}
                  whileTap={canSend ? { scale: 0.9 } : {}}
                  onClick={handleSend}
                  disabled={!canSend}
                  style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: canSend ? 'pointer' : 'default',
                    border: 'none', marginBottom: 1,
                    background: canSend ? 'var(--text-primary)' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? (
                    <Loader2 style={{ width: 14, height: 14, color: 'var(--text-muted)' }} className="animate-spin" />
                  ) : (
                    <ArrowUp style={{ width: 14, height: 14, color: canSend ? 'var(--bg-base)' : 'var(--text-muted)' }} />
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
