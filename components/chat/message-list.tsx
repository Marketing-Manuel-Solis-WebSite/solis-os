'use client';
import { useEffect, useRef, useState } from 'react';
import { Reply, Pin, Trash2, Edit2, MoreHorizontal, SmilePlus, Check, CheckCheck } from 'lucide-react';

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
  const [showMenu, setShowMenu] = useState<string | null>(null);

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
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1" onClick={() => { setShowEmoji(null); setShowMenu(null); }}>
      {messages.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-700 text-sm">No messages yet. Start the conversation!</p>
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
            <div key={first.id} className="flex justify-center py-2">
              <span className="text-[11px] text-gray-600 bg-[#111827] px-3 py-1 rounded-full border border-[#1F2937]/40">
                {first.content}
              </span>
            </div>
          );
        }

        return (
          <div key={first.id} className="flex gap-3 anim-fade group/msg" onMouseEnter={() => setHoverId(first.id)} onMouseLeave={() => setHoverId(null)}>
            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-xs font-bold text-[#D4A843] shrink-0 mt-0.5">
              {(first.displayName || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {/* Name + Time */}
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-sm font-semibold text-white">{first.displayName}</span>
                {member?.role && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#1F2937] text-gray-600">{member.role}</span>}
                {time && <span className="text-[10px] text-gray-700">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
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
                      <Reply className="h-3 w-3 text-gray-600" />
                      <span className="text-[10px] text-[#D4A843]">{msg.replyAuthor}</span>
                      <span className="text-[10px] text-gray-600 truncate max-w-[200px]">{msg.replyPreview}</span>
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
                  <div className={`text-sm leading-relaxed ${msg.deleted ? 'italic text-gray-600' : 'text-gray-300'}`}>
                    {msg.content}
                    {msg.edited && !msg.deleted && <span className="text-[9px] text-gray-700 ml-1.5">(edited)</span>}
                  </div>

                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => {
                        const reacted = users.includes(userId);
                        return (
                          <button key={emoji} onClick={e => { e.stopPropagation(); onReaction(msg.id, emoji); }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition border ${
                              reacted
                                ? 'bg-[#D4A843]/10 border-[#D4A843]/20 text-[#D4A843]'
                                : 'bg-[#111827] border-[#1F2937] text-gray-500 hover:border-gray-600'
                            }`}>
                            <span>{emoji}</span>
                            <span className="text-[10px] font-semibold">{users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Hover actions */}
                  {hoverId === msg.id && !msg.deleted && (
                    <div className="absolute -top-3 right-0 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-[#0C1017] border border-[#1F2937] shadow-lg z-10"
                      onClick={e => e.stopPropagation()}>
                      {/* Quick emoji */}
                      <button onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)} className="p-1 text-gray-600 hover:text-gray-300 rounded transition" title="React">
                        <SmilePlus className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onReply(msg)} className="p-1 text-gray-600 hover:text-gray-300 rounded transition" title="Reply">
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                      {(canManage || msg.userId === userId) && (
                        <button onClick={() => onPin(msg.id, msg.pinned)} className={`p-1 rounded transition ${msg.pinned ? 'text-[#D4A843]' : 'text-gray-600 hover:text-gray-300'}`} title={msg.pinned ? 'Unpin' : 'Pin'}>
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {msg.userId === userId && (
                        <button onClick={() => onEdit(msg)} className="p-1 text-gray-600 hover:text-blue-400 rounded transition" title="Edit">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(canManage || msg.userId === userId) && (
                        <button onClick={() => { if (confirm('Delete this message?')) onDelete(msg.id); }} className="p-1 text-gray-600 hover:text-red-400 rounded transition" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Emoji picker */}
                  {showEmoji === msg.id && (
                    <div className="absolute -top-10 right-0 flex gap-0.5 p-1.5 rounded-xl bg-[#0C1017] border border-[#1F2937] shadow-xl z-20"
                      onClick={e => e.stopPropagation()}>
                      {QUICK_EMOJIS.map(em => (
                        <button key={em} onClick={() => { onReaction(msg.id, em); setShowEmoji(null); }}
                          className="w-7 h-7 rounded-lg hover:bg-[#1F2937] flex items-center justify-center text-sm transition">
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}