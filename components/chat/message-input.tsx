'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Reply, Edit2, Paperclip, Image as ImageIcon, FileVideo, Loader2 } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

interface Props {
  channelName: string;
  members: any[];
  replyTo: any;
  editingMsg: any;
  onSend: (content: string, mentions: string[]) => void;
  onEdit: (msgId: string, content: string) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

export default function MessageInput({ channelName, members, replyTo, editingMsg, onSend, onEdit, onCancelReply, onCancelEdit }: Props) {
  const [txt, setTxt] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previews, setPreviews] = useState<{ file: File; url: string; type: string }[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMsg) {
      setTxt(editingMsg.content || '');
      inputRef.current?.focus();
    }
  }, [editingMsg?.id]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo?.id]);

  const uploadFile = async (file: File): Promise<string> => {
    const path = `chat-uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      task.on('state_changed',
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newPreviews: { file: File; url: string; type: string }[] = [];
    Array.from(files).forEach(file => {
      if (file.size > 25 * 1024 * 1024) {
        alert(`"${file.name}" es demasiado grande. Máximo 25MB.`);
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

    if (editingMsg) {
      onEdit(editingMsg.id, txt.trim());
      setTxt('');
      return;
    }

    // Upload files first
    if (previews.length > 0) {
      setUploading(true);
      try {
        const urls: string[] = [];
        for (const p of previews) {
          const url = await uploadFile(p.file);
          urls.push(url);
        }
        const fullContent = [txt.trim(), ...urls].filter(Boolean).join('\n');
        onSend(fullContent, mentions);
        previews.forEach(p => URL.revokeObjectURL(p.url));
        setPreviews([]);
      } catch (err: any) {
        alert('Error al subir archivo: ' + (err.message || 'Error'));
      }
      setUploading(false);
      setUploadProgress(0);
    } else {
      onSend(txt.trim(), mentions);
    }
    setTxt('');
    setMentions([]);
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
    <div className="border-t border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm shrink-0">
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
            <div className="flex items-center gap-2 px-5 py-2 border-b border-[var(--border)] bg-[var(--bg-base)]/50">
              {replyTo && (
                <>
                  <Reply className="h-3.5 w-3.5 text-[#D4A843]" />
                  <span className="text-xs text-[var(--text-muted)]">Respondiendo a</span>
                  <span className="text-xs text-[#D4A843] font-semibold">{replyTo.displayName}</span>
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
            <div className="flex gap-2 px-5 pt-3 pb-1 flex-wrap">
              {previews.map((p, i) => (
                <div key={i} className="relative group">
                  {p.type.startsWith('image/') ? (
                    <img src={p.url} alt="Preview" className="h-20 w-20 object-cover rounded-xl border border-[var(--border)]" />
                  ) : p.type.startsWith('video/') ? (
                    <div className="h-20 w-20 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center">
                      <FileVideo className="h-6 w-6 text-[var(--text-muted)]" />
                    </div>
                  ) : (
                    <div className="h-20 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-secondary)] truncate max-w-[80px]">{p.file.name}</span>
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
                  <motion.div className="h-full bg-[#D4A843] rounded-full" animate={{ width: `${uploadProgress}%` }} />
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
            className="mx-5 mb-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl overflow-hidden"
          >
            {filteredMembers.map(m => (
              <motion.button
                key={m.id}
                whileHover={{ backgroundColor: 'var(--hover-bg)' }}
                onClick={() => insertMention(m)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition">
                <div className="w-6 h-6 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[10px] font-bold text-[#D4A843]">
                  {m.displayName?.[0]?.toUpperCase()}
                </div>
                <span>{m.displayName}</span>
                {m.role && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-muted)] ml-auto">{m.role}</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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
            className="h-[42px] w-[42px] rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 hover:bg-[var(--gold)]/5 transition shrink-0"
            title="Adjuntar archivo"
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
              placeholder={`Mensaje ${channelName ? '#' + channelName : ''}... (@ para mencionar)`}
              rows={1}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[#D4A843]/40 focus:ring-1 focus:ring-[#D4A843]/10 resize-none max-h-32 transition-all"
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
            onClick={handleSubmit}
            disabled={(!txt.trim() && previews.length === 0) || uploading}
            className={`h-[42px] px-5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              editingMsg
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:bg-blue-500/30'
                : 'btn-gold disabled:opacity-30'
            }`}>
            <Send className="h-4 w-4" />
            {editingMsg ? 'Editar' : 'Enviar'}
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
