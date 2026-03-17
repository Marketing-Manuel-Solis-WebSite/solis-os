'use client';

// ============================================================
// Space Chat Embed — Lightweight inline chat for space pages.
// Shows recent messages from the space's auto-channel with
// ability to send new messages.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';
import { Send, MessageSquare, Loader2 } from 'lucide-react';

interface Props {
  spaceId: string;
  spaceName: string;
}

interface Message {
  id: string;
  content: string;
  userId: string;
  displayName: string;
  createdAt: any;
}

export default function SpaceChatEmbed({ spaceId, spaceName }: Props) {
  const { lang } = useI18n();
  const { user, me } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Find or identify the space channel
  useEffect(() => {
    const orgId = getCurrentOrgId();
    const channelsRef = collection(db, 'orgs', orgId, 'channels');
    const q = query(channelsRef, where('teamId', '==', spaceId), where('type', '==', 'public'), limit(1));
    getDocs(q).then(snap => {
      if (snap.docs.length > 0) {
        setChannelId(snap.docs[0].id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [spaceId]);

  // Listen to messages
  useEffect(() => {
    if (!channelId) return;
    const orgId = getCurrentOrgId();
    const messagesRef = collection(db, 'orgs', orgId, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [channelId]);

  const handleSend = async () => {
    if (!newMessage.trim() || !channelId || !user?.uid || sending) return;
    setSending(true);
    try {
      const orgId = getCurrentOrgId();
      const messagesRef = collection(db, 'orgs', orgId, 'channels', channelId, 'messages');
      await addDoc(messagesRef, {
        content: newMessage.trim(),
        userId: user.uid,
        displayName: me?.displayName || user.email || '',
        photoURL: me?.photoURL || '',
        type: 'text',
        replyTo: null,
        reactions: {},
        pinned: false,
        edited: false,
        deleted: false,
        mentions: [],
        attachments: [],
        readBy: [user.uid],
        createdAt: Timestamp.now(),
      });
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!channelId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
        <MessageSquare className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-[13px]">
          {lang === 'es'
            ? `No hay canal de chat para ${spaceName}. Crea uno desde Chat.`
            : `No chat channel for ${spaceName}. Create one from Chat.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[var(--accent)]" />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          #{spaceName.toLowerCase().replace(/\s+/g, '-')}
        </span>
        <span className="text-[11px] text-[var(--text-muted)] ml-auto">{messages.length} {lang === 'es' ? 'mensajes' : 'messages'}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-[12px] text-[var(--text-muted)] py-8">
            {lang === 'es' ? 'Sin mensajes aún. ¡Sé el primero!' : 'No messages yet. Be the first!'}
          </p>
        ) : (
          messages.map(msg => {
            const isMe = msg.userId === user?.uid;
            const time = msg.createdAt?.toDate?.();
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[10px] font-bold text-[var(--accent)] shrink-0 mt-0.5">
                  {(msg.displayName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[12px] font-semibold ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                      {msg.displayName || 'Unknown'}
                    </span>
                    {time && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {time.toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)] break-words">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={lang === 'es' ? 'Escribe un mensaje...' : 'Type a message...'}
            className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-base)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
          />
          <button onClick={handleSend} disabled={!newMessage.trim() || sending}
            className="h-9 w-9 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
