'use client';
import { useState } from 'react';
import { X, UserPlus, Shield, ShieldOff, MessageCircle, UserMinus, Search, Crown, Check } from 'lucide-react';

interface Props {
  channel: any;
  members: any[];
  userId: string;
  canManage: boolean;
  onClose: () => void;
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
  onToggleAdmin: (userId: string) => void;
  onStartDM: (userId: string) => void;
}

export default function MemberDrawer({ channel, members, userId, canManage, onClose, onAdd, onRemove, onToggleAdmin, onStartDM }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const channelMembers = members.filter(m => channel.members?.includes(m.id));
  const nonMembers = members.filter(m => !channel.members?.includes(m.id) && m.displayName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-[320px] shrink-0 bg-[#0C1017] border-l border-[#1F2937]/60 flex flex-col h-full overflow-hidden anim-slide">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1F2937]/60">
        <h3 className="text-sm font-bold text-white">Members ({channelMembers.length})</h3>
        <div className="flex items-center gap-1">
          {canManage && (
            <button onClick={() => setShowAdd(!showAdd)} className={`p-2 rounded-lg transition ${showAdd ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-gray-400'}`} title="Add member">
              <UserPlus className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Add member panel */}
      {showAdd && canManage && (
        <div className="p-3 border-b border-[#1F2937]/40 bg-[#0A0E16]">
          <p className="text-[10px] text-[#D4A843] uppercase font-semibold tracking-wider mb-2">Add Members</p>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-dark h-8 text-xs mb-2" />
          <div className="max-h-36 overflow-y-auto space-y-0.5">
            {nonMembers.length === 0 ? (
              <p className="text-xs text-gray-700 text-center py-3">No more members to add</p>
            ) : nonMembers.map(m => (
              <button key={m.id} onClick={() => onAdd(m.id)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.03] transition">
                <div className="w-6 h-6 rounded-full bg-[#1F2937] flex items-center justify-center text-[9px] font-bold text-gray-500">
                  {m.displayName?.[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-left">{m.displayName}</span>
                <UserPlus className="h-3 w-3 text-emerald-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {channelMembers.map(m => {
          const isCreator = channel.createdBy === m.id;
          const isChannelAdmin = channel.admins?.includes(m.id);
          const isSelf = m.id === userId;

          return (
            <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.02] group transition">
              <div className="w-8 h-8 rounded-full bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-xs font-bold text-[#D4A843] shrink-0">
                {m.displayName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white truncate">{m.displayName}</span>
                  {isSelf && <span className="text-[9px] text-gray-600">(you)</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {isCreator && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#D4A843]/10 text-[#D4A843] font-semibold flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" />Owner</span>}
                  {isChannelAdmin && !isCreator && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" />Admin</span>}
                  {m.department && <span className="text-[9px] text-gray-600">{m.department}</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                {!isSelf && (
                  <button onClick={() => onStartDM(m.id)} className="p-1.5 text-gray-600 hover:text-gray-300 rounded-lg" title="Direct message">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                )}
                {canManage && !isCreator && !isSelf && (
                  <>
                    <button onClick={() => onToggleAdmin(m.id)}
                      className={`p-1.5 rounded-lg transition ${isChannelAdmin ? 'text-blue-400 hover:text-gray-400' : 'text-gray-600 hover:text-blue-400'}`}
                      title={isChannelAdmin ? 'Remove admin' : 'Make admin'}>
                      {isChannelAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => { if (confirm(`Remove ${m.displayName}?`)) onRemove(m.id); }}
                      className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg" title="Remove">
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}