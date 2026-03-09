'use client';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  getAllUserChannels, getChannels, createChannel, updateChannel, deleteChannel, archiveChannel,
  getMessages, sendMessage, editMessage, deleteMessage as deleteMsg,
  pinMessage, unpinMessage, addReaction, removeReaction,
  addChannelMember, removeChannelMember, addChannelAdmin, removeChannelAdmin,
  findOrCreateDM, sendSystemMessage, onMessagesSnapshot, getMembers, logAction,
  setTyping, clearTyping, onTypingSnapshot,
  setPresence, onPresenceSnapshot,
  markChannelRead, onReadCursorsSnapshot,
} from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import ChannelSidebar from '@/components/chat/channel-sidebar';
import ChannelHeader from '@/components/chat/channel-header';
import MessageList from '@/components/chat/message-list';
import MessageInput from '@/components/chat/message-input';
import ChannelSettings from '@/components/chat/channel-settings';
import CreateChannelModal from '@/components/chat/create-channel-modal';
import MemberDrawer from '@/components/chat/member-drawer';
import PinnedDrawer from '@/components/chat/pinned-drawer';
import { MessageSquare, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatPage() {
  const { t } = useI18n();
  const { user, me, isAdmin, activeTeamId, teams, can, canSeeAllTeams } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [msgsHasMore, setMsgsHasMore] = useState(false);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [clearedChannels, setClearedChannels] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [readCursors, setReadCursors] = useState<Record<string, any>>({});
  const unsubRef = useRef<(() => void) | null>(null);
  const typingUnsubRef = useRef<(() => void) | null>(null);
  const presenceUnsubRef = useRef<(() => void) | null>(null);
  const readCursorUnsubRef = useRef<(() => void) | null>(null);

  // Offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Load channels + members
  const loadChannels = useCallback(async () => {
    if (!user) return;
    const [chsResult, mems] = await Promise.all([
      // Admins/directors see ALL channels; others see only their channels
      canSeeAllTeams
        ? getChannels('__all__').catch(() => ({ items: [], hasMore: false }))
        : getAllUserChannels(user.uid),
      getMembers(),
    ]);
    setMembers(mems);
    // Sort: DMs last, then by lastMessage
    const sorted = (chsResult.items as any[]).sort((a: any, b: any) => {
      if (a.type === 'dm' && b.type !== 'dm') return 1;
      if (a.type !== 'dm' && b.type === 'dm') return -1;
      return (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0);
    });
    setChannels(sorted);
    setLoading(false);
  }, [user, canSeeAllTeams]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // Subscribe to real-time messages when channel changes
  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (!active) { setMsgs([]); setMsgsLoading(false); return; }
    setMsgsLoading(true);
    const unsub = onMessagesSnapshot(active.id, (newMsgs, hasMore) => {
      setMsgs(newMsgs);
      setMsgsHasMore(hasMore);
      setMsgsLoading(false);
    });
    unsubRef.current = unsub;
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [active?.id]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (typingUnsubRef.current) { typingUnsubRef.current(); typingUnsubRef.current = null; }
    if (!active) { setTypingUsers([]); return; }
    const unsub = onTypingSnapshot(active.id, (users) => {
      setTypingUsers(users.filter(u => u.id !== user?.uid));
    });
    typingUnsubRef.current = unsub;
    return () => { if (typingUnsubRef.current) typingUnsubRef.current(); };
  }, [active?.id, user?.uid]);

  // Presence: set online + heartbeat + listen
  useEffect(() => {
    if (!user) return;
    setPresence(user.uid, true);
    const interval = setInterval(() => setPresence(user.uid, true), 60000);
    const handleVisibility = () => setPresence(user.uid, !document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    const handleUnload = () => setPresence(user.uid, false);
    window.addEventListener('beforeunload', handleUnload);
    const unsub = onPresenceSnapshot(setOnlineMap);
    presenceUnsubRef.current = unsub;
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      setPresence(user.uid, false);
      if (presenceUnsubRef.current) presenceUnsubRef.current();
    };
  }, [user?.uid]);

  // Read cursors listener
  useEffect(() => {
    if (!user) return;
    const unsub = onReadCursorsSnapshot(user.uid, setReadCursors);
    readCursorUnsubRef.current = unsub;
    return () => { if (readCursorUnsubRef.current) readCursorUnsubRef.current(); };
  }, [user?.uid]);

  // Mark active channel as read
  useEffect(() => {
    if (active && user) markChannelRead(user.uid, active.id);
  }, [active?.id, user?.uid]);

  // Helpers
  const getDMName = (ch: any) => {
    if (ch.type !== 'dm') return ch.name;
    const otherId = ch.members?.find((id: string) => id !== user?.uid);
    const other = members.find(m => m.id === otherId);
    return other?.displayName || ch.name;
  };

  const canManageChannel = (ch: any) => {
    if (!ch || !user) return false;
    if (can('channel', 'manage')) return true;
    if (ch.createdBy === user.uid) return true;
    if (ch.admins?.includes(user.uid)) return true;
    return false;
  };

  // Actions
  const handleSend = async (content: string, mentions: string[]) => {
    if (!active || !content.trim()) return;
    await sendMessage(active.id, {
      content: content.trim(),
      userId: user!.uid,
      displayName: me!.displayName,
      photoURL: me!.photoURL || '',
      mentions,
      replyTo: replyTo?.id || null,
      replyPreview: replyTo?.content?.slice(0, 60) || null,
      replyAuthor: replyTo?.displayName || null,
    });
    setReplyTo(null);

    // Notify channel members (except sender)
    const recipientIds = (active.members || []).filter((id: string) => id !== user!.uid);
    if (recipientIds.length > 0) {
      const channelName = active.type === 'dm' ? t('chat.dm') : `#${active.name}`;
      notifyMany(recipientIds, {
        type: 'channel_message',
        title: t('chat.newMessage', { channel: channelName }),
        message: content.trim().slice(0, 80),
        entityType: 'channel',
        entityId: active.id,
        entityUrl: '/app/chat',
        actorId: user!.uid,
        actorName: me!.displayName,
      }).catch((err) => console.error('[Chat] notify channel message failed:', err));
    }

    // Notify mentioned users separately
    if (mentions.length > 0) {
      const mentionRecipients = mentions.filter(id => id !== user!.uid);
      if (mentionRecipients.length > 0) {
        notifyMany(mentionRecipients, {
          type: 'channel_mention',
          title: t('chat.mentionedYou', { name: me!.displayName, channel: active.type === 'dm' ? t('chat.mentionedInDm') : '#' + active.name }),
          message: content.trim().slice(0, 80),
          entityType: 'channel',
          entityId: active.id,
          entityUrl: '/app/chat',
          actorId: user!.uid,
          actorName: me!.displayName,
        }).catch((err) => console.error('[Chat] notify channel mention failed:', err));
      }
    }

    loadChannels(); // refresh last message
  };

  const handleEdit = async (msgId: string, content: string) => {
    if (!active) return;
    await editMessage(active.id, msgId, content);
    setEditingMsg(null);
  };

  const handleDelete = async (msgId: string) => {
    if (!active) return;
    await deleteMsg(active.id, msgId);
  };

  const handlePin = async (msgId: string, isPinned: boolean) => {
    if (!active) return;
    if (isPinned) await unpinMessage(active.id, msgId);
    else await pinMessage(active.id, msgId);
    // Refresh active channel data
    const updated = channels.find(c => c.id === active.id);
    if (updated) {
      const pins = updated.pinnedMessages || [];
      if (isPinned) {
        setActive({ ...active, pinnedMessages: pins.filter((id: string) => id !== msgId) });
      } else {
        setActive({ ...active, pinnedMessages: [...pins, msgId] });
      }
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    if (!active || !user) return;
    const msg = msgs.find(m => m.id === msgId);
    const userReacted = msg?.reactions?.[emoji]?.includes(user.uid);
    if (userReacted) await removeReaction(active.id, msgId, emoji, user.uid);
    else await addReaction(active.id, msgId, emoji, user.uid);
  };

  const handleCreateChannel = async (data: any) => {
    const ch = await createChannel({
      ...data,
      teamId: activeTeamId === '__all__' ? '' : activeTeamId,
      createdBy: user!.uid,
      createdByName: me!.displayName,
      members: [user!.uid, ...(data.members || [])],
      admins: [user!.uid],
    });
    await sendSystemMessage(ch.id, `${me!.displayName} created this channel`);
    await logAction({ action: 'created', resource: 'channel', detail: data.name, actorId: user!.uid, actorName: me!.displayName });
    setShowCreate(false);
    await loadChannels();
    // Select new channel
    const { items: all } = await getAllUserChannels(user!.uid);
    const newest = (all as any[]).find(c => c.id === ch.id);
    if (newest) setActive(newest);
  };

  const handleDeleteChannel = async () => {
    if (!active) return;
    if (!confirm(t('chat.deleteChannelConfirm', { name: active.name }))) return;
    await deleteChannel(active.id);
    await logAction({ action: 'deleted', resource: 'channel', detail: active.name, actorId: user!.uid, actorName: me!.displayName });
    setActive(null);
    setShowSettings(false);
    loadChannels();
  };

  const handleArchiveChannel = async () => {
    if (!active) return;
    await archiveChannel(active.id);
    await sendSystemMessage(active.id, `${me!.displayName} archived this channel`);
    setActive(null);
    setShowSettings(false);
    loadChannels();
  };

  const handleUpdateChannel = async (data: any) => {
    if (!active) return;
    await updateChannel(active.id, data);
    setActive({ ...active, ...data });
    setShowSettings(false);
    loadChannels();
  };

  const handleAddMember = async (userId: string) => {
    if (!active) return;
    await addChannelMember(active.id, userId);
    const m = members.find(mem => mem.id === userId);
    await sendSystemMessage(active.id, `${me!.displayName} added ${m?.displayName || 'a member'}`);
    setActive({ ...active, members: [...(active.members || []), userId] });
    loadChannels();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!active) return;
    await removeChannelMember(active.id, userId);
    const m = members.find(mem => mem.id === userId);
    await sendSystemMessage(active.id, `${m?.displayName || 'A member'} was removed`);
    setActive({ ...active, members: (active.members || []).filter((id: string) => id !== userId) });
    loadChannels();
  };

  const handleToggleAdmin = async (userId: string) => {
    if (!active) return;
    const isChannelAdmin = active.admins?.includes(userId);
    if (isChannelAdmin) await removeChannelAdmin(active.id, userId);
    else await addChannelAdmin(active.id, userId);
    const admins = isChannelAdmin
      ? (active.admins || []).filter((id: string) => id !== userId)
      : [...(active.admins || []), userId];
    setActive({ ...active, admins });
  };

  const handleStartDM = async (targetId: string) => {
    const target = members.find(m => m.id === targetId);
    if (!target) return;
    const dm = await findOrCreateDM(user!.uid, me!.displayName, targetId, target.displayName);
    await loadChannels();
    setActive(dm);
  };

  const pinnedMsgs = msgs.filter(m => m.pinned);
  const displayMsgs = active && clearedChannels.has(active.id) ? [] : msgs;

  const handleClearView = () => {
    if (!active) return;
    if (!confirm(t('chat.clearView'))) return;
    setClearedChannels(prev => new Set([...prev, active.id]));
  };

  return (
    <div className="flex h-[calc(100vh-64px)] relative">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Channel Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 lg:static lg:z-auto transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <ChannelSidebar
          channels={channels}
          active={active}
          members={members}
          userId={user?.uid || ''}
          search={search}
          onlineMap={onlineMap}
          readCursors={readCursors}
          onSearchChange={setSearch}
          onSelect={(ch) => { setActive(ch); setSidebarOpen(false); }}
          onCreate={() => setShowCreate(true)}
          onStartDM={(id) => { handleStartDM(id); setSidebarOpen(false); }}
          getDMName={getDMName}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Offline banner */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2 text-sm text-red-400 font-medium">
                <WifiOff className="h-4 w-4 shrink-0" />
                {t('chat.offline')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {active ? (
          <>
            <ChannelHeader
              channel={active}
              members={members}
              userId={user?.uid || ''}
              pinnedCount={pinnedMsgs.length}
              memberCount={(active.members || []).length}
              canManage={canManageChannel(active)}
              onlineMap={onlineMap}
              getDMName={getDMName}
              onShowSettings={() => setShowSettings(true)}
              onShowMembers={() => setShowMembers(true)}
              onShowPinned={() => setShowPinned(true)}
              onAddMember={handleAddMember}
              onClearView={handleClearView}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />
            {msgsHasMore && !msgsLoading && (
              <div className="px-5 py-2 text-center">
                <span className="text-[12px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-3 py-1 rounded-full">
                  Mostrando los últimos 100 mensajes
                </span>
              </div>
            )}
            <MessageList
              messages={displayMsgs}
              members={members}
              userId={user?.uid || ''}
              channelType={active.type}
              canManage={canManageChannel(active)}
              loading={msgsLoading}
              onReply={setReplyTo}
              onEdit={setEditingMsg}
              onDelete={handleDelete}
              onPin={handlePin}
              onReaction={handleReaction}
            />
            {/* Typing indicator */}
            <AnimatePresence>
              {typingUsers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 py-1.5 text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    {typingUsers.length === 1
                      ? t('chat.typing', { name: typingUsers[0].name })
                      : typingUsers.length === 2
                        ? t('chat.typingTwo', { name1: typingUsers[0].name, name2: typingUsers[1].name })
                        : t('chat.typingMany', { n: typingUsers.length })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <MessageInput
              channelName={active.type === 'dm' ? getDMName(active) : active.name}
              members={members}
              replyTo={replyTo}
              editingMsg={editingMsg}
              showSuggestions={msgs.length === 0 && !msgsLoading}
              onTypingStart={() => active && user && me && setTyping(active.id, user.uid, me.displayName)}
              onTypingStop={() => active && user && clearTyping(active.id, user.uid)}
              onSend={handleSend}
              onEdit={handleEdit}
              onCancelReply={() => setReplyTo(null)}
              onCancelEdit={() => setEditingMsg(null)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-16 h-16 rounded-xl bg-[var(--accent-subtle)] shadow-card flex items-center justify-center mx-auto mb-4 hover:bg-[var(--accent)]/20 transition-all duration-200">
                <MessageSquare className="h-7 w-7 text-[var(--accent)]/60" />
              </button>
              <div className="hidden lg:flex w-16 h-16 rounded-xl bg-[var(--accent-subtle)] shadow-card items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-7 w-7 text-[var(--accent)]/60" />
              </div>
              <p className="text-lg font-semibold text-[var(--text-secondary)]">{t('chat.selectChannel')}</p>
              <p className="text-base text-[var(--text-muted)] mt-1">{t('chat.selectChannelHint')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right drawers */}
      {showMembers && active && (
        <MemberDrawer
          channel={active}
          members={members}
          userId={user?.uid || ''}
          canManage={canManageChannel(active)}
          onClose={() => setShowMembers(false)}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
          onToggleAdmin={handleToggleAdmin}
          onStartDM={handleStartDM}
        />
      )}
      {showPinned && active && (
        <PinnedDrawer
          messages={pinnedMsgs}
          members={members}
          onClose={() => setShowPinned(false)}
          onUnpin={(msgId: string) => handlePin(msgId, true)}
        />
      )}
      {showSettings && active && (
        <ChannelSettings
          channel={active}
          canManage={canManageChannel(active)}
          onClose={() => setShowSettings(false)}
          onUpdate={handleUpdateChannel}
          onDelete={handleDeleteChannel}
          onArchive={handleArchiveChannel}
        />
      )}

      {/* Create Channel Modal */}
      {showCreate && (
        <CreateChannelModal
          members={members}
          teams={teams}
          userId={user?.uid || ''}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateChannel}
        />
      )}
    </div>
  );
}