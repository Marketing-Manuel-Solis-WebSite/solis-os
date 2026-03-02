'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Reply, Edit2, Paperclip, FileVideo, Loader2 } from 'lucide-react';
import { uploadFile as sharedUploadFile, isImageType, isVideoType, formatFileSize } from '@/lib/upload';
import { useToast } from '@/components/notifications/toast-provider';

const QUICK_SUGGESTIONS = [
  { label: 'Hola a todos', icon: '👋' },
  { label: 'Buenos días', icon: '☀️' },
  { label: 'Listo', icon: '✅' },
  { label: 'Gracias', icon: '🙏' },
  { label: 'De acuerdo', icon: '👍' },
  { label: 'Entendido', icon: '📝' },
];

interface Props {
  channelName: string;
  members: any[];
  replyTo: any;
  editingMsg: any;
  showSuggestions?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onSend: (content: string, mentions: string[]) => void;
  onEdit: (msgId: string, content: string) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

export default function MessageInput({ channelName, members, replyTo, editingMsg, showSuggestions, onTypingStart, onTypingStop, onSend, onEdit, onCancelReply, onCancelEdit }: Props) {
  const toast = useToast();
  const [txt, setTxt] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; url: string; type: string }[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTyping = useCallback(() => {
    onTypingStart?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 4000);
  }, [onTypingStart, onTypingStop]);

  useEffect(() => {
    if (editingMsg) {
      setTxt(editingMsg.content || '');
      inputRef.current?.focus();
    }
  }, [editingMsg?.id]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo?.id]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newPreviews: { file: File; url: string; type: string }[] = [];
    Array.from(files).forEach(file => {
      if (file.size > 100 * 1024 * 1024) {
        toast.warning('Archivo muy grande', `"${file.name}" excede el limite de 100MB.`);
        return;
      }
      const url = URL.createObjectURL(file);
      newPreviews.push({ file, url, type: file.type });
    });
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removePreview = (idx: number) => {
    setPreviews(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!txt.trim() && previews.length === 0) return;
    if (sending || uploading) return; // Prevent double send
    onTypingStop?.();
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }

    if (editingMsg) {
      onEdit(editingMsg.id, txt.trim());
      setTxt('');
      return;
    }

    setSending(true);

    // Upload files first
    if (previews.length > 0) {
      setUploading(true);
      try {
        const urls: string[] = [];
        for (const p of previews) {
          const result = await sharedUploadFile(p.file, 'chat-uploads', (pct) => setUploadProgress(pct));
          urls.push(result.url);
        }
        const fullContent = [txt.trim(), ...urls].filter(Boolean).join('\n');
        onSend(fullContent, mentions);
        previews.forEach(p => URL.revokeObjectURL(p.url));
        setPreviews([]);
      } catch (err: any) {
        toast.error('Error al subir archivo', err.message || 'Ocurrio un error al subir el archivo.');
      }
      setUploading(false);
      setUploadProgress(0);
    } else {
      onSend(txt.trim(), mentions);
    }
    setTxt('');
    setMentions([]);
    setTimeout(() => setSending(false), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === '@') {
      setShowMentions(true);
      setMentionQuery('');
    }
  };

  const handleChange = (val: string) => {
    setTxt(val);
    if (val.trim()) emitTyping();
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member: any) => {
    const atMatch = txt.match(/@(\w*)$/);
    if (atMatch) {
      const before = txt.slice(0, txt.length - atMatch[0].length);
      setTxt(`${before}@${member.displayName} `);
      setMentions([...mentions, member.id]);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMembers = members.filter(m =>
    m.displayName?.toLowerCase().includes(mentionQuery)
  ).slice(0, 6);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      handleFiles(dt.files);
    }
  };

  return (
    <div className="bg-[var(--bg-elevated)]/50 shrink-0">
      {/* Reply / Edit banner */}
      <AnimatePresence>
        {(replyTo || editingMsg) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-2 bg-[var(--bg-base)]/50">
              {replyTo && (
                <>
                  <Reply className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="text-xs text-[var(--text-muted)]">Respondiendo a</span>
                  <span className="text-xs text-[var(--accent)] font-semibold">{replyTo.displayName}</span>
                  <span className="text-xs text-[var(--text-muted)] truncate flex-1">{replyTo.content?.slice(0, 50)}</span>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={onCancelReply} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md transition">
                    <X className="h-3.5 w-3.5" />
                  </motion.button>
                </>
              )}
              {editingMsg && (
                <>
                  <Edit2 className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs text-blue-400 font-semibold flex-1">Editando mensaje</span>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => { onCancelEdit(); setTxt(''); }} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md transition">
                    <X className="h-3.5 w-3.5" />
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File previews */}
      <AnimatePresence>
        {previews.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2.5 px-5 pt-3 pb-1 flex-wrap">
              {previews.map((p, i) => (
                <div key={i} className="relative group">
                  {isImageType(p.type) ? (
                    <img src={p.url} alt="Preview" className="h-24 w-24 object-cover rounded-xl shadow-card" />
                  ) : isVideoType(p.type) ? (
                    <div className="h-24 w-24 rounded-xl shadow-card bg-[var(--bg-elevated)] flex flex-col items-center justify-center gap-1">
                      <FileVideo className="h-6 w-6 text-blue-400" />
                      <span className="text-[9px] text-[var(--text-muted)] truncate max-w-[70px]">{p.file.name}</span>
                    </div>
                  ) : (
                    <div className="h-24 px-4 rounded-xl shadow-card bg-[var(--bg-elevated)] flex flex-col items-center justify-center gap-1">
                      <Paperclip className="h-5 w-5 text-[var(--text-muted)]" />
                      <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[100px] text-center">{p.file.name}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">{formatFileSize(p.file.size)}</span>
                    </div>
                  )}
                  <button onClick={() => removePreview(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {uploading && (
              <div className="px-5 pb-2">
                <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <motion.div className="h-full bg-[var(--accent)] rounded-full" animate={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Subiendo... {uploadProgress}%</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mention dropdown */}
      <AnimatePresence>
        {showMentions && filteredMembers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="mx-5 mb-1 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden"
          >
            {filteredMembers.map(m => (
              <motion.button
                key={m.id}
                whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                onClick={() => insertMention(m)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition">
                <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--accent)]">
                  {m.displayName?.[0]?.toUpperCase()}
                </div>
                <span className="font-medium">{m.displayName}</span>
                {m.role && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)] ml-auto">{m.role}</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick suggestion chips */}
      {showSuggestions && !editingMsg && !replyTo && (
        <div className="flex gap-2 px-5 pt-3 pb-1 overflow-x-auto scrollbar-thin">
          {QUICK_SUGGESTIONS.map(s => (
            <motion.button
              key={s.label}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSend(s.label, [])}
              className="shrink-0 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] shadow-card text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all duration-200 flex items-center gap-1.5"
            >
              <span>{s.icon}</span>
              {s.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-4">
        <div className="flex items-end gap-2">
          {/* File upload button */}
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-[42px] w-[42px] rounded-lg bg-[var(--bg-elevated)] shadow-card flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all duration-200 shrink-0"
            title="Adjuntar archivo (máx 100MB)"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </motion.button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={txt}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              aria-label="Escribe un mensaje"
              placeholder={`Escribe un mensaje en ${channelName ? '#' + channelName : ''}...`}
              rows={1}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-elevated)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--accent)]/15 focus:shadow-none resize-none max-h-32 transition-all duration-200"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            animate={sending ? { scale: [1, 1.15, 1], rotate: [0, -10, 0] } : {}}
            transition={{ duration: 0.3 }}
            onClick={handleSubmit}
            disabled={(!txt.trim() && previews.length === 0) || uploading || sending}
            className={`h-[42px] px-5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              editingMsg
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:bg-blue-500/30'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition disabled:opacity-30'
            }`}>
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{editingMsg ? 'Editar' : 'Enviar'}</span>
          </motion.button>
        </div>
        <div className="flex items-center gap-3 mt-1.5 px-1">
          <span className="text-[11px] text-[var(--text-muted)]">Shift+Enter nueva línea</span>
          <span className="text-[11px] text-[var(--text-muted)]">@ para mencionar</span>
          <span className="text-[11px] text-[var(--text-muted)]">Pega imágenes del portapapeles</span>
        </div>
      </div>
    </div>
  );
}
