'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Lock, MessageCircle, Plus, Search, ChevronDown, ChevronRight, X } from 'lucide-react';

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

  const availableDMMembers = members.filter(m => m.id !== userId);

  return (
    <aside className="w-64 bg-[var(--bg-card)]/50 border-r border-[var(--border)] flex flex-col shrink-0 backdrop-blur-sm">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-[var(--text-primary)]">Messages</span>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
            onClick={onCreate} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#D4A843] hover:bg-[#D4A843]/10 transition" title="New Channel">
            <Plus className="h-4 w-4" />
          </motion.button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search channels..."
            className="w-full h-8 pl-8 pr-8 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[#D4A843]/40 transition-colors" />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Channels Section */}
        {!filtered && (
          <div className="p-2">
            <button onClick={() => setShowChannels(!showChannels)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
              <motion.span animate={{ rotate: showChannels ? 0 : -90 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-3 w-3" />
              </motion.span>
              Channels <span className="text-[var(--text-muted)] ml-auto opacity-60">{publicChannels.length}</span>
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {(filtered || showChannels) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-2 space-y-0.5 overflow-hidden"
            >
              {displayChannels.map((ch, i) => {
                const isActive = active?.id === ch.id;
                const icon = ch.type === 'private'
                  ? <Lock className="h-3.5 w-3.5 shrink-0" />
                  : <Hash className="h-3.5 w-3.5 shrink-0" />;
                return (
                  <motion.button
                    key={ch.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    onClick={() => onSelect(ch)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 group relative ${
                      isActive
                        ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold shadow-sm shadow-[#D4A843]/5'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                    }`}>
                    {isActive && (
                      <motion.div layoutId="channel-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#D4A843]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    {icon}
                    <span className="flex-1 text-left truncate">{ch.name}</span>
                    {ch.type === 'private' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--bg-base)] text-[var(--text-muted)] opacity-60">{(ch.members || []).length}</span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* DMs Section */}
        {!filtered && dmChannels.length > 0 && (
          <>
            <div className="p-2 mt-2">
              <button onClick={() => setShowDMs(!showDMs)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
                <motion.span animate={{ rotate: showDMs ? 0 : -90 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-3 w-3" />
                </motion.span>
                Direct Messages <span className="text-[var(--text-muted)] ml-auto opacity-60">{dmChannels.length}</span>
              </button>
            </div>
            <AnimatePresence initial={false}>
              {showDMs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-2 space-y-0.5 overflow-hidden"
                >
                  {displayDMs.map((ch, i) => {
                    const isActive = active?.id === ch.id;
                    const name = getDMName(ch);
                    const otherId = ch.members?.find((id: string) => id !== userId);
                    const other = members.find(m => m.id === otherId);
                    return (
                      <motion.button
                        key={ch.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        onClick={() => onSelect(ch)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 relative ${
                          isActive ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold shadow-sm shadow-[#D4A843]/5' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                        }`}>
                        {isActive && (
                          <motion.div layoutId="channel-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#D4A843]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                        )}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isActive ? 'bg-[#D4A843]/20 text-[#D4A843]' : 'bg-[#D4A843]/10 text-[#D4A843]/70'}`}>
                          {name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <span className="block truncate">{name}</span>
                          {ch.lastMessagePreview && (
                            <span className="block text-[10px] text-[var(--text-muted)] truncate opacity-60">{ch.lastMessagePreview}</span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* New DM button */}
        {!filtered && (
          <div className="px-2 mt-3">
            <motion.button
              whileHover={{ backgroundColor: 'var(--hover-bg)' }}
              onClick={() => setShowDMList(!showDMList)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
              <MessageCircle className="h-3.5 w-3.5" />
              New Direct Message
              <Plus className="h-3 w-3 ml-auto" />
            </motion.button>
            <AnimatePresence>
              {showDMList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 space-y-0.5 ml-2 pl-3 border-l-2 border-[#D4A843]/20 overflow-hidden"
                >
                  {availableDMMembers.map(m => (
                    <motion.button
                      key={m.id}
                      whileHover={{ x: 2 }}
                      onClick={() => { onStartDM(m.id); setShowDMList(false); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition">
                      <div className="w-5 h-5 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[9px] font-bold text-[#D4A843]">
                        {m.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      {m.displayName}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </aside>
  );
}
