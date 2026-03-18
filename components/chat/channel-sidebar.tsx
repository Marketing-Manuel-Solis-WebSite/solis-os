'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Lock, MessageCircle, Plus, Search, ChevronDown, ChevronRight, X, MapPin, FolderOpen, List } from 'lucide-react';

interface Props {
  channels: any[];
  active: any;
  members: any[];
  userId: string;
  search: string;
  onlineMap?: Record<string, boolean>;
  readCursors?: Record<string, any>;
  onSearchChange: (v: string) => void;
  onSelect: (ch: any) => void;
  onCreate: () => void;
  onStartDM: (userId: string) => void;
  getDMName: (ch: any) => string;
}

export default function ChannelSidebar({ channels, active, members, userId, search, onlineMap, readCursors, onSearchChange, onSelect, onCreate, onStartDM, getDMName }: Props) {
  const { t } = useI18n();
  const [showDMs, setShowDMs] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const [showLocationChannels, setShowLocationChannels] = useState(true);
  const [showDMList, setShowDMList] = useState(false);

  const publicChannels = channels.filter(c => c.type !== 'dm' && !c.linkedEntityType);
  const locationChannels = channels.filter(c => c.type !== 'dm' && !!c.linkedEntityType);
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
    <aside role="navigation" aria-label={t('chat.channels')} className="w-72 lg:w-64 h-full bg-[var(--bg-elevated)] lg:bg-[var(--bg-elevated)]/60 shadow-panel flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-[var(--text-primary)]">{t('chat.messages')}</span>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
            onClick={onCreate} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition" title={t('chat.newChannel')}>
            <Plus className="h-4 w-4" />
          </motion.button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder={t('chat.searchChannels')}
            className="w-full h-8 pl-8 pr-8 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30 focus:bg-[var(--bg-elevated)] focus:shadow-sm transition-all duration-200" />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Location Channels Section */}
        {!filtered && locationChannels.length > 0 && (
          <div className="px-2 pt-3 pb-1">
            <button onClick={() => setShowLocationChannels(!showLocationChannels)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
              <motion.span animate={{ rotate: showLocationChannels ? 0 : -90 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-3 w-3" />
              </motion.span>
              Location Channels <span className="text-[var(--text-muted)] ml-auto opacity-60">{locationChannels.length}</span>
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {!filtered && showLocationChannels && locationChannels.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-2 space-y-0.5 overflow-hidden"
            >
              {locationChannels.map((ch, i) => {
                const isActive = active?.id === ch.id;
                const isUnread = !isActive && ch.lastMessageAt?.seconds > (readCursors?.[ch.id]?.seconds || 0);
                const locationIcon = ch.linkedEntityType === 'space'
                  ? <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  : ch.linkedEntityType === 'folder'
                    ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    : <List className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />;
                return (
                  <motion.button
                    key={ch.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    onClick={() => onSelect(ch)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-all duration-200 group relative ${
                      isActive
                        ? 'bg-[var(--accent)]/10 text-[var(--text-primary)] font-semibold border-l-[3px] border-l-[var(--accent)] rounded-r-xl'
                        : isUnread
                          ? 'text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-hover)] rounded-md'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md'
                    }`}>
                    {locationIcon}
                    <span className="flex-1 text-left truncate">{ch.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] opacity-70 shrink-0">{ch.linkedEntityType}</span>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Channels Section */}
        {!filtered && (
          <div className="px-2 pt-3 pb-1">
            <button onClick={() => setShowChannels(!showChannels)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
              <motion.span animate={{ rotate: showChannels ? 0 : -90 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-3 w-3" />
              </motion.span>
              {t('chat.channels')} <span className="text-[var(--text-muted)] ml-auto opacity-60">{publicChannels.length}</span>
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
                const isUnread = !isActive && ch.lastMessageAt?.seconds > (readCursors?.[ch.id]?.seconds || 0);
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
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-all duration-200 group relative ${
                      isActive
                        ? 'bg-[var(--accent)]/10 text-[var(--text-primary)] font-semibold border-l-[3px] border-l-[var(--accent)] rounded-r-xl'
                        : isUnread
                          ? 'text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-hover)] rounded-md'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md'
                    }`}>
                    {icon}
                    <span className="flex-1 text-left truncate">{ch.name}</span>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />}
                    {ch.type === 'private' && !isUnread && (
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
            <div className="px-2 pt-4 pb-1">
              <button onClick={() => setShowDMs(!showDMs)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
                <motion.span animate={{ rotate: showDMs ? 0 : -90 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-3 w-3" />
                </motion.span>
                {t('chat.directMessages')} <span className="text-[var(--text-muted)] ml-auto opacity-60">{dmChannels.length}</span>
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
                    const isUnread = !isActive && ch.lastMessageAt?.seconds > (readCursors?.[ch.id]?.seconds || 0);
                    const name = getDMName(ch);
                    const otherId = ch.members?.find((id: string) => id !== userId);
                    const isOnline = otherId ? onlineMap?.[otherId] : false;
                    return (
                      <motion.button
                        key={ch.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        onClick={() => onSelect(ch)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-all duration-200 relative ${
                          isActive
                            ? 'bg-[var(--accent)]/10 text-[var(--text-primary)] font-semibold border-l-[3px] border-l-[var(--accent)] rounded-r-xl'
                            : isUnread
                              ? 'text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-hover)] rounded-md'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md'
                        }`}>
                        <div className="relative shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${isActive ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--accent)]/10 text-[var(--accent)]/70'}`}>
                            {name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-elevated)] ${isOnline ? 'bg-[#22C55E]' : 'bg-[var(--text-muted)]/40'}`} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <span className="block truncate">{name}</span>
                          {ch.lastMessagePreview && (
                            <span className="block text-[12px] text-[var(--text-muted)] truncate opacity-60">{ch.lastMessagePreview}</span>
                          )}
                        </div>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />}
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
              whileHover={{ backgroundColor: 'var(--bg-hover)' }}
              onClick={() => setShowDMList(!showDMList)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
              <MessageCircle className="h-3.5 w-3.5" />
              {t('chat.newDirectMessage')}
              <Plus className="h-3 w-3 ml-auto" />
            </motion.button>
            <AnimatePresence>
              {showDMList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 space-y-0.5 ml-2 pl-3 border-l-2 border-[var(--accent)]/20 overflow-hidden"
                >
                  {availableDMMembers.map(m => (
                    <motion.button
                      key={m.id}
                      whileHover={{ x: 2 }}
                      onClick={() => { onStartDM(m.id); setShowDMList(false); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[9px] font-bold text-[var(--accent)]">
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
