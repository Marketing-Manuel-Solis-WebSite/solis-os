'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Lock, Users, Pin, Settings, MessageCircle, UserPlus, Search, X, Check } from 'lucide-react';

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
  onAddMember?: (userId: string) => void;
}

export default function ChannelHeader({ channel, members, userId, pinnedCount, memberCount, canManage, getDMName, onShowSettings, onShowMembers, onShowPinned, onAddMember }: Props) {
  const isDM = channel.type === 'dm';
  const name = isDM ? getDMName(channel) : channel.name;
  const icon = isDM
    ? <MessageCircle className="h-4 w-4 text-[#D4A843]" />
    : channel.type === 'private'
      ? <Lock className="h-4 w-4 text-amber-400" />
      : <Hash className="h-4 w-4 text-[#D4A843]" />;

  // DM other user
  const otherId = isDM ? channel.members?.find((id: string) => id !== userId) : null;
  const otherMember = otherId ? members.find(m => m.id === otherId) : null;

  // Quick add member popover
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handler = (e: MouseEvent) => { if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAdd(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAdd]);

  const channelMembers = channel.members || [];
  const nonMembers = members.filter(m => !channelMembers.includes(m.id) && m.id !== userId);
  const filtered = addSearch
    ? nonMembers.filter(m => m.displayName?.toLowerCase().includes(addSearch.toLowerCase()) || m.email?.toLowerCase().includes(addSearch.toLowerCase()))
    : nonMembers;

  return (
    <div className="h-14 border-b border-[var(--border)] glass flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {isDM && otherMember ? (
          <div className="w-8 h-8 rounded-full bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-sm font-bold text-[#D4A843] shrink-0">
            {otherMember.displayName?.[0]?.toUpperCase() || '?'}
          </div>
        ) : icon}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)] text-sm truncate">{name}</span>
            {channel.type === 'private' && !isDM && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">PRIVATE</span>
            )}
          </div>
          {channel.description && !isDM && (
            <p className="text-[11px] text-[var(--text-muted)] truncate">{channel.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {pinnedCount > 0 && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onShowPinned} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[#D4A843] hover:bg-[#D4A843]/5 transition" title="Pinned messages">
            <Pin className="h-3.5 w-3.5" /><span>{pinnedCount}</span>
          </motion.button>
        )}
        {!isDM && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onShowMembers} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition" title="Members">
            <Users className="h-3.5 w-3.5" /><span>{memberCount}</span>
          </motion.button>
        )}

        {/* Quick Add Member Button */}
        {canManage && !isDM && onAddMember && (
          <div ref={addRef} className="relative">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowAdd(!showAdd)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${showAdd ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-[var(--text-muted)] hover:text-[#22C55E] hover:bg-[#22C55E]/5'}`}
              title="Add member">
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add</span>
            </motion.button>

            <AnimatePresence>
              {showAdd && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-full mt-2 w-[280px] rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] shadow-2xl shadow-black/30 overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-[var(--border)]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search members..."
                        autoFocus className="w-full h-8 pl-9 pr-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[#D4A843]" />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1.5">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] text-center py-4">
                        {nonMembers.length === 0 ? 'Everyone is already a member' : 'No matches found'}
                      </p>
                    ) : filtered.slice(0, 10).map(m => (
                      <motion.button key={m.id} whileHover={{ backgroundColor: 'var(--hover-bg)' }}
                        onClick={() => { onAddMember(m.id); setShowAdd(false); setAddSearch(''); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition">
                        <div className="w-7 h-7 rounded-lg bg-[#D4A843]/10 flex items-center justify-center text-[10px] font-bold text-[#D4A843] shrink-0">
                          {m.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{m.displayName}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{m.role} {m.department ? `· ${m.department}` : ''}</p>
                        </div>
                        <UserPlus className="h-3.5 w-3.5 text-[#22C55E] shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {canManage && !isDM && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onShowSettings} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition" title="Channel settings">
            <Settings className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
