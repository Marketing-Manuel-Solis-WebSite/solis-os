'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Lock, Users, Pin, Settings, MessageCircle, UserPlus, Search, X, Check, Eraser, Menu } from 'lucide-react';

interface Props {
  channel: any;
  members: any[];
  userId: string;
  pinnedCount: number;
  memberCount: number;
  canManage: boolean;
  onlineMap?: Record<string, boolean>;
  getDMName: (ch: any) => string;
  onShowSettings: () => void;
  onShowMembers: () => void;
  onShowPinned: () => void;
  onAddMember?: (userId: string) => void;
  onClearView?: () => void;
  onToggleSidebar?: () => void;
}

export default function ChannelHeader({ channel, members, userId, pinnedCount, memberCount, canManage, onlineMap, getDMName, onShowSettings, onShowMembers, onShowPinned, onAddMember, onClearView, onToggleSidebar }: Props) {
  const isDM = channel.type === 'dm';
  const name = isDM ? getDMName(channel) : channel.name;
  const icon = isDM
    ? <MessageCircle className="h-4 w-4 text-[var(--accent)]" />
    : channel.type === 'private'
      ? <Lock className="h-4 w-4 text-amber-400" />
      : <Hash className="h-4 w-4 text-[var(--accent)]" />;

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
    <div role="banner" className="h-14 bg-[var(--bg-elevated)]/80 flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} className="lg:hidden p-2 -ml-2 mr-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition" aria-label="Abrir menú">
            <Menu className="h-5 w-5" />
          </button>
        )}
        {isDM && otherMember ? (
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-sm font-bold text-[var(--accent)] shrink-0">
            {otherMember.displayName?.[0]?.toUpperCase() || '?'}
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)] text-sm truncate">{name}</span>
            {channel.type === 'private' && !isDM && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">PRIVATE</span>
            )}
          </div>
          {isDM && otherId && (
            <p className={`text-[13px] flex items-center gap-1 ${onlineMap?.[otherId] ? 'text-[#22C55E]' : 'text-[var(--text-muted)]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${onlineMap?.[otherId] ? 'bg-[#22C55E]' : 'bg-[var(--text-muted)]/40'}`} />
              {onlineMap?.[otherId] ? 'En línea' : 'Desconectado'}
            </p>
          )}
          {channel.description && !isDM && (
            <p className="text-[13px] text-[var(--text-muted)] truncate">{channel.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center rounded-md bg-[var(--bg-base)]/50 shadow-card overflow-hidden divide-x divide-[var(--border-subtle)]">
          {pinnedCount > 0 && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onShowPinned} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition" title="Pinned messages">
              <Pin className="h-3.5 w-3.5" /><span>{pinnedCount}</span>
            </motion.button>
          )}
          {!isDM && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onShowMembers} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition" title="Members">
              <Users className="h-3.5 w-3.5" /><span>{memberCount}</span>
            </motion.button>
          )}
        </div>

        {/* Quick Add Member Button */}
        {canManage && !isDM && onAddMember && (
          <div ref={addRef} className="relative">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowAdd(!showAdd)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition ${showAdd ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[#22C55E] hover:bg-[#22C55E]/5'}`}
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
                  className="absolute right-0 top-full mt-2 w-[280px] rounded-xl bg-[var(--bg-base)] shadow-dropdown overflow-hidden z-50"
                >
                  <div className="p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search members..."
                        autoFocus className="w-full h-8 pl-9 pr-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30" />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1.5">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)] text-center py-4">
                        {nonMembers.length === 0 ? 'Everyone is already a member' : 'No matches found'}
                      </p>
                    ) : filtered.slice(0, 10).map(m => (
                      <motion.button key={m.id} whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                        onClick={() => { onAddMember(m.id); setShowAdd(false); setAddSearch(''); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition">
                        <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[12px] font-bold text-[var(--accent)] shrink-0">
                          {m.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{m.displayName}</p>
                          <p className="text-[12px] text-[var(--text-muted)] truncate">{m.role} {m.department ? `· ${m.department}` : ''}</p>
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

        {onClearView && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onClearView} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition" title="Limpiar vista">
            <Eraser className="h-4 w-4" />
          </motion.button>
        )}
        {canManage && !isDM && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onShowSettings} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition" title="Channel settings">
            <Settings className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
