'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Pin, Trash2, Edit2, SmilePlus, Image as ImageIcon, FileText, Play } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '💯'];

interface Props {
  messages: any[];
  members: any[];
  userId: string;
  channelType: string;
  canManage: boolean;
  onReply: (msg: any) => void;
  onEdit: (msg: any) => void;
  onDelete: (msgId: string) => void;
  onPin: (msgId: string, isPinned: boolean) => void;
  onReaction: (msgId: string, emoji: string) => void;
}

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

export default function MessageList({ messages, members, userId, channelType, canManage, onReply, onEdit, onDelete, onPin, onReaction }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const getMember = (uid: string) => members.find(m => m.id === uid);

  // Group consecutive messages by same user within 5min
  const grouped: any[][] = [];
  messages.forEach((msg, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const sameUser = prev && prev.userId === msg.userId && msg.type !== 'system' && prev.type !== 'system';
    const within5min = prev && msg.createdAt?.seconds && prev.createdAt?.seconds && (msg.createdAt.seconds - prev.createdAt.seconds) < 300;
    if (sameUser && within5min) {
      grouped[grouped.length - 1].push(msg);
    } else {
      grouped.push([msg]);
    }
  });

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-1 scrollbar-thin" onClick={() => { setShowEmoji(null); }}>
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-base font-medium text-[var(--text-secondary)]">No hay mensajes aún</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">¡Inicia la conversación!</p>
          </div>
        </div>
      )}

      {grouped.map((group, gi) => {
        const first = group[0];
        const isSystem = first.type === 'system';
        const isMine = first.userId === userId;
        const member = getMember(first.userId);
        const time = first.createdAt?.toDate?.();

        if (isSystem) {
          return (
            <motion.div
              key={first.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center py-3"
            >
              <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-4 py-1.5 rounded-full border border-[var(--border)]">
                {first.content}
              </span>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={first.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex gap-3.5 group/msg py-2.5 rounded-2xl hover:bg-[var(--hover-bg)] px-3 -mx-3 transition-colors ${isMine ? 'flex-row-reverse' : ''}`}
            onMouseEnter={() => setHoverId(first.id)}
            onMouseLeave={() => setHoverId(null)}
          >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
              isMine
                ? 'bg-[var(--gold)]/15 border border-[var(--gold)]/25 text-[var(--gold)]'
                : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)]'
            }`}>
              {(first.displayName || '?')[0].toUpperCase()}
            </div>
            <div className={`flex-1 min-w-0 max-w-[75%] ${isMine ? 'items-end' : ''}`}>
              {/* Name + Time */}
              <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{first.displayName}</span>
                {member?.role && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)]">{member.role}</span>
                )}
                {time && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              {/* Messages in group */}
              {group.map(msg => {
                const media = extractMediaUrls(msg.content || '');
                return (
                  <div key={msg.id}
                    className={`relative group/single mb-1.5 ${msg.deleted ? 'opacity-50' : ''}`}
                    onMouseEnter={() => setHoverId(msg.id)}
                    onMouseLeave={() => { if (hoverId === msg.id) setHoverId(null); }}>

                    {/* Reply indicator */}
                    {msg.replyTo && (
                      <div className={`flex items-center gap-1.5 mb-1.5 ${isMine ? 'justify-end' : ''}`}>
                        <Reply className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--gold)] font-medium">{msg.replyAuthor}</span>
                        <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{msg.replyPreview}</span>
                      </div>
                    )}

                    {/* Pin indicator */}
                    {msg.pinned && (
                      <div className={`flex items-center gap-1 mb-1 ${isMine ? 'justify-end' : ''}`}>
                        <Pin className="h-3.5 w-3.5 text-[var(--gold)]" />
                        <span className="text-[10px] text-[var(--gold)] font-semibold">Fijado</span>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`inline-block rounded-2xl px-4 py-2.5 max-w-full ${
                      isMine
                        ? 'bg-[var(--gold)]/10 border border-[var(--gold)]/15 ml-auto'
                        : 'bg-[var(--bg-card)] border border-[var(--border)]'
                    } ${isMine ? 'float-right clear-both' : ''}`}>
                      {/* Text content */}
                      {(media.textContent || !media.hasMedia) && (
                        <div className={`text-[15px] leading-relaxed whitespace-pre-wrap ${msg.deleted ? 'italic text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
                          {media.hasMedia ? media.textContent : msg.content}
                          {msg.edited && !msg.deleted && <span className="text-[10px] text-[var(--text-muted)] ml-2">(editado)</span>}
                        </div>
                      )}

                      {/* Image attachments */}
                      {media.images.length > 0 && (
                        <div className={`${media.textContent ? 'mt-2' : ''} space-y-2`}>
                          {media.images.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={url} alt="Shared image" className="max-w-full max-h-80 rounded-xl border border-[var(--border)] hover:opacity-90 transition" loading="lazy" />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Video attachments */}
                      {media.videos.length > 0 && (
                        <div className={`${media.textContent ? 'mt-2' : ''} space-y-2`}>
                          {media.videos.map((url, idx) => (
                            <video key={idx} controls className="max-w-full max-h-80 rounded-xl border border-[var(--border)]" preload="metadata">
                              <source src={url} />
                            </video>
                          ))}
                        </div>
                      )}

                      {/* File attachments from msg.attachments */}
                      {msg.attachments?.length > 0 && (
                        <div className={`${msg.content ? 'mt-2' : ''} space-y-1.5`}>
                          {msg.attachments.map((att: any, idx: number) => (
                            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--gold)]/30 transition text-sm">
                              {att.type?.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-[var(--gold)]" /> :
                               att.type?.startsWith('video/') ? <Play className="h-4 w-4 text-blue-400" /> :
                               <FileText className="h-4 w-4 text-[var(--text-muted)]" />}
                              <span className="truncate text-[var(--text-secondary)]">{att.name || 'Archivo'}</span>
                              <span className="text-[10px] text-[var(--text-muted)] ml-auto shrink-0">{att.size ? `${(att.size / 1024).toFixed(0)}KB` : ''}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="clear-both" />

                    {/* Reactions */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex gap-1.5 mt-2 flex-wrap ${isMine ? 'justify-end' : ''}`}>
                        {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => {
                          const reacted = users.includes(userId);
                          return (
                            <motion.button
                              key={emoji}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={e => { e.stopPropagation(); onReaction(msg.id, emoji); }}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition border ${
                                reacted
                                  ? 'bg-[var(--gold)]/10 border-[var(--gold)]/20 text-[var(--gold)]'
                                  : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                              }`}>
                              <span>{emoji}</span>
                              <span className="text-xs font-semibold">{users.length}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Hover actions */}
                    <AnimatePresence>
                      {hoverId === msg.id && !msg.deleted && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.12 }}
                          className={`absolute -top-4 ${isMine ? 'left-0' : 'right-0'} flex items-center gap-0.5 px-1 py-0.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-lg z-10`}
                          onClick={e => e.stopPropagation()}>
                          <button onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--gold)] rounded-lg hover:bg-[var(--hover-bg)] transition" title="Reaccionar">
                            <SmilePlus className="h-4 w-4" />
                          </button>
                          <button onClick={() => onReply(msg)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--hover-bg)] transition" title="Responder">
                            <Reply className="h-4 w-4" />
                          </button>
                          {(canManage || msg.userId === userId) && (
                            <button onClick={() => onPin(msg.id, msg.pinned)} className={`p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition ${msg.pinned ? 'text-[var(--gold)]' : 'text-[var(--text-muted)] hover:text-[var(--gold)]'}`} title={msg.pinned ? 'Desfijar' : 'Fijar'}>
                              <Pin className="h-4 w-4" />
                            </button>
                          )}
                          {msg.userId === userId && (
                            <button onClick={() => onEdit(msg)} className="p-1.5 text-[var(--text-muted)] hover:text-blue-400 rounded-lg hover:bg-[var(--hover-bg)] transition" title="Editar">
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {(canManage || msg.userId === userId) && (
                            <button onClick={() => { if (confirm('¿Eliminar este mensaje?')) onDelete(msg.id); }} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg hover:bg-[var(--hover-bg)] transition" title="Eliminar">
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
                          className={`absolute -top-14 ${isMine ? 'left-0' : 'right-0'} flex gap-0.5 p-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl z-20`}
                          onClick={e => e.stopPropagation()}>
                          {QUICK_EMOJIS.map(em => (
                            <motion.button
                              key={em}
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.8 }}
                              onClick={() => { onReaction(msg.id, em); setShowEmoji(null); }}
                              className="w-8 h-8 rounded-lg hover:bg-[var(--hover-bg)] flex items-center justify-center text-base transition">
                              {em}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
