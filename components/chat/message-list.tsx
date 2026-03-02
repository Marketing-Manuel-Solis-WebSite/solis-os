'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Pin, Trash2, Edit2, SmilePlus, Image as ImageIcon, FileText, Play, Download, ArrowRight, ChevronDown } from 'lucide-react';
import { formatFileSize } from '@/lib/upload';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '💯'];

interface Props {
  messages: any[];
  members: any[];
  userId: string;
  channelType: string;
  canManage: boolean;
  loading?: boolean;
  onReply: (msg: any) => void;
  onEdit: (msg: any) => void;
  onDelete: (msgId: string) => void;
  onPin: (msgId: string, isPinned: boolean) => void;
  onReaction: (msgId: string, emoji: string) => void;
}

// ========== SKELETON ==========
function MessageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="px-4 py-4 space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3.5 animate-pulse">
          <div className="w-10 h-10 rounded-full skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <div className="h-3.5 w-24 skeleton rounded" />
              <div className="h-3 w-12 skeleton rounded" />
            </div>
            <div className="h-4 skeleton rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
            {i % 3 === 0 && <div className="h-4 skeleton rounded" style={{ width: `${30 + Math.random() * 30}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========== HELPERS ==========

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function extractMediaUrls(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex) || [];
  const images = urls.filter(isImageUrl);
  const videos = urls.filter(isVideoUrl);
  const textContent = content.replace(urlRegex, '').trim();
  return { images, videos, textContent, hasMedia: images.length > 0 || videos.length > 0 };
}

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Hoy';
  if (msgDate.getTime() === yesterday.getTime()) return 'Ayer';
  return date.toLocaleDateString('es-MX', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderMessageText(text: string, members: any[]): React.ReactNode {
  const parts = text.split(/(@[A-Za-záéíóúñüÁÉÍÓÚÑÜ]+(?:\s[A-Za-záéíóúñüÁÉÍÓÚÑÜ]+)?)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1);
      const isMember = members.some(m =>
        m.displayName?.toLowerCase() === name.toLowerCase() ||
        m.displayName?.toLowerCase().startsWith(name.toLowerCase())
      );
      if (isMember) {
        return (
          <span key={i} className="bg-[var(--accent)]/15 text-[var(--accent)] px-1 rounded font-medium">
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

// ========== GROUPED ITEM TYPES ==========
type GroupedItem =
  | { type: 'date'; label: string; id: string }
  | { type: 'group'; messages: any[]; id: string };

// ========== COMPONENT ==========
export default function MessageList({ messages, members, userId, channelType, canManage, loading, onReply, onEdit, onDelete, onPin, onReaction }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMsgCountRef = useRef(messages.length);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewMessages(false);
  }, []);

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      if (isAtBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setHasNewMessages(true);
      }
    } else if (messages.length > 0 && prevMsgCountRef.current === 0) {
      // Initial load — scroll to bottom immediately
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessages(false);
  };

  const getMember = (uid: string) => members.find(m => m.id === uid);

  // Build grouped items with date separators
  const grouped: GroupedItem[] = [];
  let currentDay: string | null = null;
  let currentGroup: any[] = [];

  const flushGroup = () => {
    if (currentGroup.length > 0) {
      grouped.push({ type: 'group', messages: [...currentGroup], id: currentGroup[0].id });
      currentGroup = [];
    }
  };

  messages.forEach((msg, i) => {
    const msgDate = msg.createdAt?.toDate?.();
    const dayKey = msgDate ? `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}` : null;

    // Insert date separator if day changed
    if (dayKey && dayKey !== currentDay) {
      flushGroup();
      currentDay = dayKey;
      grouped.push({ type: 'date', label: formatDateSeparator(msgDate), id: `date-${dayKey}` });
    }

    const prev = i > 0 ? messages[i - 1] : null;
    const sameUser = prev && prev.userId === msg.userId && msg.type !== 'system' && prev.type !== 'system';
    const within5min = prev && msg.createdAt?.seconds && prev.createdAt?.seconds && (msg.createdAt.seconds - prev.createdAt.seconds) < 300;
    const prevDate = prev?.createdAt?.toDate?.();
    const sameDay2 = msgDate && prevDate && isSameDay(msgDate, prevDate);

    if (sameUser && within5min && sameDay2) {
      currentGroup.push(msg);
    } else {
      flushGroup();
      currentGroup = [msg];
    }
  });
  flushGroup();

  // Show skeletons while loading
  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <MessageSkeleton />
      </div>
    );
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} role="log" aria-live="polite" aria-label="Mensajes del canal" className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 scrollbar-thin relative" onClick={() => setShowEmoji(null)}>
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-base font-medium text-[var(--text-secondary)]">No hay mensajes aún</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">¡Inicia la conversación!</p>
          </div>
        </div>
      )}

      {grouped.map((item) => {
        // Date separator
        if (item.type === 'date') {
          return (
            <div key={item.id} className="flex items-center gap-4 py-3 px-2 my-2">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider">{item.label}</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          );
        }

        // Message group
        const group = item.messages;
        const first = group[0];
        const isSystem = first.type === 'system';
        const isMine = first.userId === userId;
        const member = getMember(first.userId);
        const time = first.createdAt?.toDate?.();

        // System message — divider style
        if (isSystem) {
          return (
            <div key={item.id} className="flex items-center gap-3 py-1.5 px-2 my-1">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3" />
                {first.content}
              </span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          );
        }

        return (
          <div key={item.id} role="article" aria-label={`${first.displayName}: ${(first.content || '').slice(0, 80)}`}>
            {/* First message — with avatar */}
            <div
              className={`flex gap-3.5 group/msg py-1.5 hover:bg-[var(--bg-hover)] px-4 -mx-4 transition-colors relative ${isMine ? 'border-l-2 border-l-[var(--accent)]/20 hover:bg-[var(--accent)]/[0.03]' : ''}`}
              onMouseEnter={() => setHoverId(first.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                style={member?.teamId ? { backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)' } : undefined}>
                {(first.displayName || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {/* Name + Role + Time */}
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">{first.displayName}</span>
                  {member?.role && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{member.role}</span>
                  )}
                  {time && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {/* First message content */}
                <MessageContent
                  msg={first}
                  members={members}
                  userId={userId}
                  canManage={canManage}
                  hoverId={hoverId}
                  showEmoji={showEmoji}
                  setHoverId={setHoverId}
                  setShowEmoji={setShowEmoji}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPin={onPin}
                  onReaction={onReaction}
                />
              </div>
            </div>

            {/* Subsequent messages — no avatar, indented */}
            {group.slice(1).map(msg => (
              <div
                key={msg.id}
                className={`group/msg hover:bg-[var(--bg-hover)] px-4 -mx-4 transition-colors relative ${isMine ? 'border-l-2 border-l-[var(--accent)]/20 hover:bg-[var(--accent)]/[0.03]' : ''}`}
                onMouseEnter={() => setHoverId(msg.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                {/* Hover timestamp where avatar would be */}
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] opacity-0 group-hover/msg:opacity-100 transition w-[40px] text-center">
                  {msg.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="pl-[54px] py-0.5">
                  <MessageContent
                    msg={msg}
                    members={members}
                    userId={userId}
                    canManage={canManage}
                    hoverId={hoverId}
                    showEmoji={showEmoji}
                    setHoverId={setHoverId}
                    setShowEmoji={setShowEmoji}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPin={onPin}
                    onReaction={onReaction}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div ref={bottomRef} />

      {/* New messages jump button */}
      <AnimatePresence>
        {hasNewMessages && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={scrollToBottom}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 mx-auto block px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-text)] text-sm font-semibold shadow-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-2 z-10"
          >
            Nuevos mensajes
            <ChevronDown className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ========== MESSAGE CONTENT ==========
function MessageContent({
  msg, members, userId, canManage, hoverId, showEmoji, setHoverId, setShowEmoji,
  onReply, onEdit, onDelete, onPin, onReaction,
}: {
  msg: any; members: any[]; userId: string; canManage: boolean;
  hoverId: string | null; showEmoji: string | null;
  setHoverId: (id: string | null) => void; setShowEmoji: (id: string | null) => void;
  onReply: (msg: any) => void; onEdit: (msg: any) => void;
  onDelete: (msgId: string) => void; onPin: (msgId: string, isPinned: boolean) => void;
  onReaction: (msgId: string, emoji: string) => void;
}) {
  const media = extractMediaUrls(msg.content || '');

  return (
    <div className={`relative ${msg.deleted ? 'opacity-50' : ''}`}>
      {/* Reply indicator */}
      {msg.replyTo && (
        <div className="flex items-center gap-1.5 mb-1">
          <Reply className="h-3 w-3 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--accent)] font-medium">{msg.replyAuthor}</span>
          <span className="text-xs text-[var(--text-muted)] truncate max-w-[250px]">{msg.replyPreview}</span>
        </div>
      )}

      {/* Pin indicator */}
      {msg.pinned && (
        <div className="flex items-center gap-1 mb-1">
          <Pin className="h-3 w-3 text-[var(--accent)]" />
          <span className="text-[10px] text-[var(--accent)] font-semibold">Fijado</span>
        </div>
      )}

      {/* Text content — flat, no bubble */}
      {(media.textContent || !media.hasMedia) && (
        <div className={`text-[15px] leading-relaxed whitespace-pre-wrap ${msg.deleted ? 'italic text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
          {renderMessageText(media.hasMedia ? media.textContent : (msg.content || ''), members)}
          {msg.edited && !msg.deleted && <span className="text-[10px] text-[var(--text-muted)] ml-2">(editado)</span>}
        </div>
      )}

      {/* Images — gallery grid */}
      {media.images.length === 1 && (
        <a href={media.images[0]} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
          <img src={media.images[0]} alt="" className="max-w-full max-h-[300px] rounded-xl shadow-card object-cover hover:opacity-90 transition-all duration-200" loading="lazy" />
        </a>
      )}
      {media.images.length > 1 && (
        <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-w-[400px]">
          {media.images.map((url, idx) => (
            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl shadow-card">
              <img src={url} alt="" className="w-full h-[150px] object-cover hover:scale-105 transition-transform duration-200" loading="lazy" />
            </a>
          ))}
        </div>
      )}

      {/* Videos */}
      {media.videos.length > 0 && (
        <div className="space-y-2 mt-1.5">
          {media.videos.map((url, idx) => (
            <video key={idx} controls className="max-w-full max-h-[300px] rounded-xl shadow-card" preload="metadata">
              <source src={url} />
            </video>
          ))}
        </div>
      )}

      {/* File attachments */}
      {msg.attachments?.length > 0 && (
        <div className={`${msg.content ? 'mt-2' : ''} space-y-1.5`}>
          {msg.attachments.map((att: any, idx: number) => {
            const isImg = att.type?.startsWith('image/');
            const isVid = att.type?.startsWith('video/');
            const ext = att.name?.split('.').pop()?.toUpperCase() || 'FILE';
            return (
              <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] shadow-card hover:shadow-md transition-all duration-200 group/file max-w-sm">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isImg ? 'bg-[var(--accent)]/10' : isVid ? 'bg-blue-500/10' : 'bg-[var(--bg-elevated)]'
                }`}>
                  {isImg ? <ImageIcon className="h-5 w-5 text-[var(--accent)]" /> :
                   isVid ? <Play className="h-5 w-5 text-blue-400" /> :
                   <FileText className="h-5 w-5 text-[var(--text-muted)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{att.name || 'Archivo'}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{ext} {att.size ? `· ${formatFileSize(att.size)}` : ''}</p>
                </div>
                <Download className="h-4 w-4 text-[var(--text-muted)] group-hover/file:text-[var(--accent)] transition shrink-0" />
              </a>
            );
          })}
        </div>
      )}

      {/* Reactions */}
      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => {
            const reacted = users.includes(userId);
            return (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={e => { e.stopPropagation(); onReaction(msg.id, emoji); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all duration-200 ${
                  reacted
                    ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/20 text-[var(--accent)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                }`}>
                <span>{emoji}</span>
                <span className="text-xs font-semibold">{users.length}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Hover actions — always top-right */}
      <AnimatePresence>
        {hoverId === msg.id && !msg.deleted && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute -top-3 right-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-[var(--bg-elevated)] shadow-dropdown z-10"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] rounded-md hover:bg-[var(--bg-hover)] transition" title="Reaccionar" aria-label="Reaccionar">
              <SmilePlus className="h-4 w-4" />
            </button>
            <button onClick={() => onReply(msg)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-hover)] transition" title="Responder" aria-label="Responder">
              <Reply className="h-4 w-4" />
            </button>
            {(canManage || msg.userId === userId) && (
              <button onClick={() => onPin(msg.id, msg.pinned)} className={`p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition ${msg.pinned ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--accent)]'}`} title={msg.pinned ? 'Desfijar' : 'Fijar'}>
                <Pin className="h-4 w-4" />
              </button>
            )}
            {msg.userId === userId && (
              <button onClick={() => onEdit(msg)} className="p-1.5 text-[var(--text-muted)] hover:text-blue-400 rounded-md hover:bg-[var(--bg-hover)] transition" title="Editar">
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            {(canManage || msg.userId === userId) && (
              <button onClick={() => { if (confirm('¿Eliminar este mensaje?')) onDelete(msg.id); }} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-md hover:bg-[var(--bg-hover)] transition" title="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmoji === msg.id && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-12 right-0 flex gap-0.5 p-1.5 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown z-20"
            onClick={e => e.stopPropagation()}>
            {QUICK_EMOJIS.map(em => (
              <motion.button
                key={em}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => { onReaction(msg.id, em); setShowEmoji(null); }}
                className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-base transition">
                {em}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
