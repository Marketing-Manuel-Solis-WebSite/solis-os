'use client';
import { Hash, Lock, Users, Pin, Settings, MessageCircle } from 'lucide-react';

interface Props {
  channel: any;
  members: any[];
  userId: string;
  pinnedCount: number;
  memberCount: number;
  canManage: boolean;
  getDMName: (ch: any) => string;
  onShowSettings: () => void;
  onShowMembers: () => void;
  onShowPinned: () => void;
}

export default function ChannelHeader({ channel, members, userId, pinnedCount, memberCount, canManage, getDMName, onShowSettings, onShowMembers, onShowPinned }: Props) {
  const isDM = channel.type === 'dm';
  const name = isDM ? getDMName(channel) : channel.name;
  const icon = isDM
    ? <MessageCircle className="h-4 w-4 text-[#D4A843]" />
    : channel.type === 'private'
      ? <Lock className="h-4 w-4 text-amber-400" />
      : <Hash className="h-4 w-4 text-[#D4A843]" />;

  // DM other user avatar
  const otherId = isDM ? channel.members?.find((id: string) => id !== userId) : null;
  const otherMember = otherId ? members.find(m => m.id === otherId) : null;

  return (
    <div className="h-14 border-b border-[#1F2937]/60 glass flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {isDM && otherMember ? (
          <div className="w-8 h-8 rounded-full bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-sm font-bold text-[#D4A843] shrink-0">
            {otherMember.displayName?.[0]?.toUpperCase() || '?'}
          </div>
        ) : (
          icon
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm truncate">{name}</span>
            {channel.type === 'private' && !isDM && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">PRIVATE</span>
            )}
          </div>
          {channel.description && !isDM && (
            <p className="text-[11px] text-gray-600 truncate">{channel.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {pinnedCount > 0 && (
          <button onClick={onShowPinned} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-[#D4A843] hover:bg-[#D4A843]/5 transition" title="Pinned messages">
            <Pin className="h-3.5 w-3.5" />
            <span>{pinnedCount}</span>
          </button>
        )}
        {!isDM && (
          <button onClick={onShowMembers} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] transition" title="Members">
            <Users className="h-3.5 w-3.5" />
            <span>{memberCount}</span>
          </button>
        )}
        {canManage && !isDM && (
          <button onClick={onShowSettings} className="p-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.03] transition" title="Channel settings">
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}