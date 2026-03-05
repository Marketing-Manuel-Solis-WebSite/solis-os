'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp, Loader2, Plus, Paperclip, Image as ImageIcon,
  Mic, MicOff, Brain, Search, X, FileText, MessageSquare,
  BookOpen, Microscope,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type AIMode = 'chat' | 'research' | 'deep';

interface Attachment {
  id: string;
  name: string;
  type: 'file' | 'image';
  preview?: string; // data URL for image preview
  file: File;
}

interface Props {
  loading: boolean;
  onSend: (content: string, mode?: AIMode, attachments?: Attachment[]) => void;
}

export default function AIInput({ loading, onSend }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<AIMode>('chat');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [knowledgeActive, setKnowledgeActive] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !loading;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleSubmit = useCallback(() => {
    if (!canSend) return;
    let finalText = text.trim();
    // Add knowledge context prefix if active
    if (knowledgeActive) {
      finalText = `[Contexto: Usar conocimiento interno de la empresa]\n\n${finalText}`;
    }
    // Add attachment names to message
    if (attachments.length > 0) {
      const names = attachments.map(a => `📎 ${a.name}`).join('\n');
      finalText = `${names}\n\n${finalText}`;
    }
    onSend(finalText, mode, attachments);
    setText('');
    setAttachments([]);
    setKnowledgeActive(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [canSend, text, mode, attachments, knowledgeActive, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  // File handling
  const handleFiles = (files: FileList | null, type: 'file' | 'image') => {
    if (!files) return;
    const newAttachments: Attachment[] = [];
    Array.from(files).forEach(file => {
      const att: Attachment = { id: `${Date.now()}-${Math.random()}`, name: file.name, type, file };
      if (type === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          att.preview = reader.result as string;
          setAttachments(prev => [...prev]);
        };
        reader.readAsDataURL(file);
      }
      newAttachments.push(att);
    });
    setAttachments(prev => [...prev, ...newAttachments]);
    setMenuOpen(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Voice input using Web Speech API
  const toggleVoice = () => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setText(prev => {
        // Replace from the last voice start point
        return transcript;
      });
      resizeTextarea();
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setMenuOpen(false);
  };

  // Mode display — use accent-compatible tones, not harsh saturated colors
  const modeConfig: Record<AIMode, { icon: any; label: string; color: string }> = {
    chat: { icon: MessageSquare, label: t('ai.chatMode'), color: 'var(--accent)' },
    research: { icon: Search, label: t('ai.researchMode'), color: 'var(--accent)' },
    deep: { icon: Microscope, label: t('ai.deepResearch'), color: 'var(--accent)' },
  };

  const currentMode = modeConfig[mode];

  return (
    <div style={{ flexShrink: 0, padding: '8px 16px 16px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        {/* Attachment previews */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}
            >
              {attachments.map(att => (
                <motion.div
                  key={att.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 10,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    fontSize: 13, color: 'var(--text-secondary)',
                  }}
                >
                  {att.type === 'image' && att.preview ? (
                    <img src={att.preview} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <FileText style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    style={{ padding: 2, borderRadius: 4, display: 'flex', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                    className="hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode pill — shows when not in chat mode */}
        <AnimatePresence>
          {mode !== 'chat' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}>
                <currentMode.icon style={{ width: 13, height: 13 }} />
                {currentMode.label}
                <button
                  onClick={() => setMode('chat')}
                  style={{ padding: 1, display: 'flex', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', opacity: 0.7 }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
              {knowledgeActive && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 8,
                  fontSize: 12, fontWeight: 600,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}>
                  <Brain style={{ width: 13, height: 13 }} />
                  {t('ai.knowledgeBase')}
                  <button
                    onClick={() => setKnowledgeActive(false)}
                    style={{ padding: 1, display: 'flex', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', opacity: 0.7 }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Knowledge pill when in chat mode */}
        <AnimatePresence>
          {mode === 'chat' && knowledgeActive && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              style={{ marginBottom: 8 }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                background: 'var(--accent-subtle)', color: 'var(--accent)',
                border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
              }}>
                <Brain style={{ width: 13, height: 13 }} />
                {t('ai.knowledgeBase')}
                <button
                  onClick={() => setKnowledgeActive(false)}
                  style={{ padding: 1, display: 'flex', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', opacity: 0.7 }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main composer */}
        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            borderRadius: 16, padding: '6px 6px 6px 6px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            ...(focused ? {
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--shadow-sm)',
            } : {}),
          }}
        >
          {/* "+" tools button */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: 'none', marginBottom: 2,
                background: menuOpen ? 'var(--bg-active)' : 'transparent',
                color: menuOpen ? 'var(--text-secondary)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              <motion.div animate={{ rotate: menuOpen ? 45 : 0 }} transition={{ duration: 0.15 }}>
                <Plus style={{ width: 18, height: 18 }} />
              </motion.div>
            </motion.button>

            {/* Tools menu */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
                    width: 260, borderRadius: 14, overflow: 'hidden',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 50,
                  }}
                >
                  {/* Tools section */}
                  <div style={{ padding: '8px 6px 4px' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '4px 10px', marginBottom: 2 }}>
                      {t('ai.tools')}
                    </p>
                    <ToolButton icon={Paperclip} label={t('ai.attachFile')} onClick={() => { fileInputRef.current?.click(); }} />
                    <ToolButton icon={ImageIcon} label={t('ai.addImage')} onClick={() => { imageInputRef.current?.click(); }} />
                    <ToolButton
                      icon={recording ? MicOff : Mic}
                      label={recording ? t('ai.recording') : t('ai.voiceInput')}
                      onClick={toggleVoice}
                      active={recording}
                    />
                    <ToolButton
                      icon={Brain}
                      label={t('ai.knowledgeBase')}
                      desc={t('ai.knowledgeBaseDesc')}
                      onClick={() => { setKnowledgeActive(!knowledgeActive); setMenuOpen(false); }}
                      active={knowledgeActive}
                    />
                  </div>

                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 12px' }} />

                  {/* Mode section */}
                  <div style={{ padding: '4px 6px 8px' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '4px 10px', marginBottom: 2 }}>
                      {t('ai.mode')}
                    </p>
                    <ToolButton
                      icon={MessageSquare} label={t('ai.chatMode')} desc={t('ai.chatModeDesc')}
                      onClick={() => { setMode('chat'); setMenuOpen(false); }}
                      active={mode === 'chat'} activeColor="var(--accent)"
                    />
                    <ToolButton
                      icon={Search} label={t('ai.researchMode')} desc={t('ai.researchModeDesc')}
                      onClick={() => { setMode('research'); setMenuOpen(false); }}
                      active={mode === 'research'}
                    />
                    <ToolButton
                      icon={Microscope} label={t('ai.deepResearch')} desc={t('ai.deepResearchDesc')}
                      onClick={() => { setMode('deep'); setMenuOpen(false); }}
                      active={mode === 'deep'}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('ai.inputPlaceholder')}
            rows={1}
            disabled={loading}
            style={{
              flex: 1, minWidth: 0, padding: '10px 8px',
              background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', fontSize: '0.9375rem', lineHeight: 1.6,
              color: 'var(--text-primary)', minHeight: 40, maxHeight: 200,
              opacity: loading ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          />

          {/* Voice recording indicator */}
          <AnimatePresence>
            {recording && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={toggleVoice}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: 'none', marginBottom: 2,
                  background: 'var(--bg-active)', color: 'var(--error)',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Mic style={{ width: 16, height: 16 }} />
                </motion.div>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Send button */}
          <motion.button
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.9 } : {}}
            onClick={handleSubmit}
            disabled={!canSend}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: canSend ? 'pointer' : 'default', border: 'none', marginBottom: 2,
              background: canSend ? 'var(--text-primary)' : 'transparent',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <Loader2 style={{ width: 16, height: 16, color: 'var(--text-muted)' }} className="animate-spin" />
            ) : (
              <ArrowUp style={{ width: 16, height: 16, color: canSend ? 'var(--bg-base)' : 'var(--text-muted)', transition: 'color 0.2s' }} />
            )}
          </motion.button>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('ai.disclaimer')}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }} className="hidden sm:block">
            <kbd style={{ padding: '2px 5px', borderRadius: 4, background: 'var(--bg-tertiary)', fontSize: 10, fontFamily: 'monospace', border: '1px solid var(--border-subtle)' }}>Enter</kbd>
            {' '}{t('ai.send')} · {' '}
            <kbd style={{ padding: '2px 5px', borderRadius: 4, background: 'var(--bg-tertiary)', fontSize: 10, fontFamily: 'monospace', border: '1px solid var(--border-subtle)' }}>Shift+Enter</kbd>
            {' '}{t('ai.newLine')}
          </p>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files, 'file')} />
        <input ref={imageInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files, 'image')} />
      </div>
    </div>
  );
}

/* ——— Tool menu button ——— */
function ToolButton({ icon: Icon, label, desc, onClick, active, activeColor }: {
  icon: any; label: string; desc?: string; onClick: () => void;
  active?: boolean; activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="transition-colors"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
        background: active ? 'var(--bg-active)' : 'transparent',
        border: 'none', textAlign: 'left',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
        else (e.currentTarget as HTMLElement).style.background = 'var(--bg-active)';
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
      }}>
        <Icon style={{ width: 16, height: 16 }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{label}</p>
        {desc && <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>{desc}</p>}
      </div>
      {active && (
        <div style={{
          marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: 'var(--text-primary)',
        }} />
      )}
    </button>
  );
}
