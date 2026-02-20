'use client';
import { useState } from 'react';
import { Hash, Lock, MessageCircle, Plus, Search, Users, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  channels: any[];
  active: any;
  members: any[];
  userId: string;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (ch: any) => void;
  onCreate: () => void;
  onStartDM: (userId: string) => void;
  getDMName: (ch: any) => string;
}

export default function ChannelSidebar({ channels, active, members, userId, search, onSearchChange, onSelect, onCreate, onStartDM, getDMName }: Props) {
  const [showDMs, setShowDMs] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const [showDMList, setShowDMList] = useState(false);

  const publicChannels = channels.filter(c => c.type !== 'dm');
  const dmChannels = channels.filter(c => c.type === 'dm');

  const filtered = search
    ? channels.filter(c => {
        const name = c.type === 'dm' ? getDMName(c) : c.name;
        return name?.toLowerCase().includes(search.toLowerCase());
      })
    : null;

  const displayChannels = filtered || publicChannels;
  const displayDMs = filtered ? [] : dmChannels;

  // Members not yet in DM
  const dmUserIds = new Set(dmChannels.flatMap((c: any) => c.members || []));
  const availableDMMembers = members.filter(m => m.id !== userId);

  return (
    <aside className="w-64 bg-[#0C1017] border-r border-[#1F2937]/60 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-[#1F2937]/60">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-white">Messages</span>
          <button onClick={onCreate} className="p-1.5 rounded-lg text-gray-600 hover:text-[#D4A843] hover:bg-[#D4A843]/10 transition" title="New Channel">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
          <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search channels..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#111827] border border-[#1F2937] text-xs text-gray-300 placeholder:text-gray-700 outline-none focus:border-[#D4A843]/30" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Channels Section */}
        {!filtered && (
          <div className="p-2">
            <button onClick={() => setShowChannels(!showChannels)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-400">
              {showChannels ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Channels <span className="text-gray-700 ml-auto">{publicChannels.length}</span>
            </button>
          </div>
        )}

        {(filtered || showChannels) && (
          <div className="px-2 space-y-0.5">
            {displayChannels.map(ch => {
              const isActive = active?.id === ch.id;
              const icon = ch.type === 'private' ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />;
              const hasUnread = ch.lastMessageAt && !isActive; // Simplified unread logic
              return (
                <button key={ch.id} onClick={() => onSelect(ch)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition group ${
                    isActive
                      ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold'
                      : hasUnread
                        ? 'text-white font-medium hover:bg-white/[0.03]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                  }`}>
                  {icon}
                  <span className="flex-1 text-left truncate">{ch.name}</span>
                  {ch.type === 'private' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1F2937] text-gray-600">{(ch.members || []).length}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* DMs Section */}
        {!filtered && dmChannels.length > 0 && (
          <>
            <div className="p-2 mt-2">
              <button onClick={() => setShowDMs(!showDMs)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-400">
                {showDMs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Direct Messages <span className="text-gray-700 ml-auto">{dmChannels.length}</span>
              </button>
            </div>
            {showDMs && (
              <div className="px-2 space-y-0.5">
                {displayDMs.map(ch => {
                  const isActive = active?.id === ch.id;
                  const name = getDMName(ch);
                  const otherId = ch.members?.find((id: string) => id !== userId);
                  const other = members.find(m => m.id === otherId);
                  return (
                    <button key={ch.id} onClick={() => onSelect(ch)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition ${
                        isActive ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                      }`}>
                      <div className="w-6 h-6 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[10px] font-bold text-[#D4A843] shrink-0">
                        {name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="block truncate">{name}</span>
                        {ch.lastMessagePreview && <span className="block text-[10px] text-gray-700 truncate">{ch.lastMessagePreview}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* New DM button */}
        {!filtered && (
          <div className="px-2 mt-3">
            <button onClick={() => setShowDMList(!showDMList)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-gray-600 hover:text-gray-300 hover:bg-white/[0.02] transition">
              <MessageCircle className="h-3.5 w-3.5" />
              New Direct Message
              <Plus className="h-3 w-3 ml-auto" />
            </button>
            {showDMList && (
              <div className="mt-1 space-y-0.5 ml-2 pl-3 border-l border-[#1F2937]/40">
                {availableDMMembers.map(m => (
                  <button key={m.id} onClick={() => { onStartDM(m.id); setShowDMList(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] transition">
                    <div className="w-5 h-5 rounded-full bg-[#1F2937] flex items-center justify-center text-[9px] font-bold text-gray-400">
                      {m.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    {m.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}