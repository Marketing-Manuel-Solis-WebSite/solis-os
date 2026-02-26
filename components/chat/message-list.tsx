'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Pin, Trash2, Edit2, SmilePlus } from 'lucide-react';

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
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 scrollbar-thin" onClick={() => { setShowEmoji(null); }}>
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#D4A843]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">No messages yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Start the conversation!</p>
          </div>
        </div>
      )}

      {grouped.map((group, gi) => {
        const first = group[0];
        const isSystem = first.type === 'system';
        const member = getMember(first.userId);
        const time = first.createdAt?.toDate?.();

        if (isSystem) {
          return (
            <motion.div
              key={first.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center py-2"
            >
              <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] px-3 py-1 rounded-full border border-[var(--border)]">
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
            className="flex gap-3 group/msg py-0.5 rounded-xl hover:bg-[var(--hover-bg)] px-2 -mx-2 transition-colors"
            onMouseEnter={() => setHoverId(first.id)}
            onMouseLeave={() => setHoverId(null)}
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-xs font-bold text-[#D4A843] shrink-0 mt-0.5">
              {(first.displayName || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {/* Name + Time */}
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{first.displayName}</span>
                {member?.role && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-muted)]">{member.role}</span>
                )}
                {time && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              {/* Messages in group */}
              {group.map(msg => (
                <div key={msg.id}
                  className={`relative group/single ${msg.deleted ? 'opacity-50' : ''}`}
                  onMouseEnter={() => setHoverId(msg.id)}
                  onMouseLeave={() => { if (hoverId === msg.id) setHoverId(null); }}>

                  {/* Reply indicator */}
                  {msg.replyTo && (
                    <div className="flex items-center gap-1.5 mb-1 ml-1">
                      <div className="w-4 h-4 border-l-2 border-t-2 border-[#D4A843]/30 rounded-tl-lg" />
                      <Reply className="h-3 w-3 text-[var(--text-muted)]" />
                      <span className="text-[10px] text-[#D4A843] font-medium">{msg.replyAuthor}</span>
                      <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px]">{msg.replyPreview}</span>
                    </div>
                  )}

                  {/* Pin indicator */}
                  {msg.pinned && (
                    <div className="flex items-center gap-1 mb-0.5 ml-1">
                      <Pin className="h-3 w-3 text-[#D4A843]" />
                      <span className="text-[9px] text-[#D4A843] font-semibold">Pinned</span>
                    </div>
                  )}

                  {/* Message content */}
                  <div className={`text-sm leading-relaxed ${msg.deleted ? 'italic text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
                    {msg.content}
                    {msg.edited && !msg.deleted && <span className="text-[9px] text-[var(--text-muted)] ml-1.5">(edited)</span>}
                  </div>

                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => {
                        const reacted = users.includes(userId);
                        return (
                          <motion.button
                            key={emoji}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={e => { e.stopPropagation(); onReaction(msg.id, emoji); }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition border ${
                              reacted
                                ? 'bg-[#D4A843]/10 border-[#D4A843]/20 text-[#D4A843]'
                                : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                            }`}>
                            <span>{emoji}</span>
                            <span className="text-[10px] font-semibold">{users.length}</span>
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
                        className="absolute -top-3 right-0 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-lg z-10"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)} className="p-1.5 text-[var(--text-muted)] hover:text-[#D4A843] rounded-md hover:bg-[var(--hover-bg)] transition" title="React">
                          <SmilePlus className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onReply(msg)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md hover:bg-[var(--hover-bg)] transition" title="Reply">
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                        {(canManage || msg.userId === userId) && (
                          <button onClick={() => onPin(msg.id, msg.pinned)} className={`p-1.5 rounded-md hover:bg-[var(--hover-bg)] transition ${msg.pinned ? 'text-[#D4A843]' : 'text-[var(--text-muted)] hover:text-[#D4A843]'}`} title={msg.pinned ? 'Unpin' : 'Pin'}>
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {msg.userId === userId && (
                          <button onClick={() => onEdit(msg)} className="p-1.5 text-[var(--text-muted)] hover:text-blue-400 rounded-md hover:bg-[var(--hover-bg)] transition" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(canManage || msg.userId === userId) && (
                          <button onClick={() => { if (confirm('Delete this message?')) onDelete(msg.id); }} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-md hover:bg-[var(--hover-bg)] transition" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
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
                        className="absolute -top-12 right-0 flex gap-0.5 p-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl z-20"
                        onClick={e => e.stopPropagation()}>
                        {QUICK_EMOJIS.map(em => (
                          <motion.button
                            key={em}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.8 }}
                            onClick={() => { onReaction(msg.id, em); setShowEmoji(null); }}
                            className="w-7 h-7 rounded-lg hover:bg-[var(--hover-bg)] flex items-center justify-center text-sm transition">
                            {em}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
