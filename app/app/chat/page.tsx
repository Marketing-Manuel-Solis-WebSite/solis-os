'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  getAllUserChannels, createChannel, updateChannel, deleteChannel, archiveChannel,
  getMessages, sendMessage, editMessage, deleteMessage as deleteMsg,
  pinMessage, unpinMessage, addReaction, removeReaction,
  addChannelMember, removeChannelMember, addChannelAdmin, removeChannelAdmin,
  findOrCreateDM, sendSystemMessage, onMessagesSnapshot, getMembers, logAction,
} from '@/lib/db';
import ChannelSidebar from '@/components/chat/channel-sidebar';
import ChannelHeader from '@/components/chat/channel-header';
import MessageList from '@/components/chat/message-list';
import MessageInput from '@/components/chat/message-input';
import ChannelSettings from '@/components/chat/channel-settings';
import CreateChannelModal from '@/components/chat/create-channel-modal';
import MemberDrawer from '@/components/chat/member-drawer';
import PinnedDrawer from '@/components/chat/pinned-drawer';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const { user, me, isAdmin, activeTeamId, teams } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [search, setSearch] = useState('');
  const unsubRef = useRef<(() => void) | null>(null);

  // Load channels + members
  const loadChannels = useCallback(async () => {
    if (!user) return;
    const [chs, mems] = await Promise.all([
      getAllUserChannels(user.uid),
      getMembers(),
    ]);
    setMembers(mems);
    // Sort: DMs last, then by lastMessage
    const sorted = (chs as any[]).sort((a: any, b: any) => {
      if (a.type === 'dm' && b.type !== 'dm') return 1;
      if (a.type !== 'dm' && b.type === 'dm') return -1;
      return (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0);
    });
    setChannels(sorted);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // Subscribe to real-time messages when channel changes
  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (!active) { setMsgs([]); return; }
    const unsub = onMessagesSnapshot(active.id, (newMsgs) => {
      setMsgs(newMsgs);
    });
    unsubRef.current = unsub;
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [active?.id]);

  // Helpers
  const getDMName = (ch: any) => {
    if (ch.type !== 'dm') return ch.name;
    const otherId = ch.members?.find((id: string) => id !== user?.uid);
    const other = members.find(m => m.id === otherId);
    return other?.displayName || ch.name;
  };

  const canManageChannel = (ch: any) => {
    if (!ch || !user) return false;
    if (isAdmin) return true;
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
    const all = await getAllUserChannels(user!.uid);
    const newest = (all as any[]).find(c => c.id === ch.id);
    if (newest) setActive(newest);
  };

  const handleDeleteChannel = async () => {
    if (!active) return;
    if (!confirm(`Delete #${active.name}? All messages will be lost.`)) return;
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

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Channel Sidebar */}
      <ChannelSidebar
        channels={channels}
        active={active}
        members={members}
        userId={user?.uid || ''}
        search={search}
        onSearchChange={setSearch}
        onSelect={setActive}
        onCreate={() => setShowCreate(true)}
        onStartDM={handleStartDM}
        getDMName={getDMName}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {active ? (
          <>
            <ChannelHeader
              channel={active}
              members={members}
              userId={user?.uid || ''}
              pinnedCount={pinnedMsgs.length}
              memberCount={(active.members || []).length}
              canManage={canManageChannel(active)}
              getDMName={getDMName}
              onShowSettings={() => setShowSettings(true)}
              onShowMembers={() => setShowMembers(true)}
              onShowPinned={() => setShowPinned(true)}
            />
            <MessageList
              messages={msgs}
              members={members}
              userId={user?.uid || ''}
              channelType={active.type}
              canManage={canManageChannel(active)}
              onReply={setReplyTo}
              onEdit={setEditingMsg}
              onDelete={handleDelete}
              onPin={handlePin}
              onReaction={handleReaction}
            />
            <MessageInput
              channelName={active.type === 'dm' ? getDMName(active) : active.name}
              members={members}
              replyTo={replyTo}
              editingMsg={editingMsg}
              onSend={handleSend}
              onEdit={handleEdit}
              onCancelReply={() => setReplyTo(null)}
              onCancelEdit={() => setEditingMsg(null)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-14 w-14 text-gray-800 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-600">Select a channel</p>
              <p className="text-sm text-gray-700 mt-1">or create a new one to start chatting</p>
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