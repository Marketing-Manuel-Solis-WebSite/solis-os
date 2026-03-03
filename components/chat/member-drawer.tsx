'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Shield, ShieldOff, MessageCircle, UserMinus, Search, Crown } from 'lucide-react';

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
  const { t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const channelMembers = members.filter(m => channel.members?.includes(m.id));
  const nonMembers = members.filter(m => !channel.members?.includes(m.id) && m.displayName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-[320px] shrink-0 bg-[var(--bg-elevated)] shadow-panel flex flex-col h-full overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3.5">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('chat.members')} ({channelMembers.length})</h3>
        <div className="flex items-center gap-1">
          {canManage && (
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setShowAdd(!showAdd)}
              className={`p-2 rounded-lg transition ${showAdd ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'text-[var(--text-muted)] hover:text-[#22C55E] hover:bg-[#22C55E]/5'}`}
              title={t('chat.addMember')}>
              <UserPlus className="h-4 w-4" />
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition">
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Add member panel */}
      <AnimatePresence>
        {showAdd && canManage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-[var(--bg-base)]/50">
              <p className="text-[12px] text-[#22C55E] uppercase font-semibold tracking-wider mb-2">{t('chat.addMembers')}</p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search') + '...'}
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-all duration-200" />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5 scrollbar-thin">
                {nonMembers.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-3">{t('chat.noMoreMembers')}</p>
                ) : nonMembers.map(m => (
                  <motion.button
                    key={m.id}
                    whileHover={{ x: 2 }}
                    onClick={() => onAdd(m.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
                    <div className="w-6 h-6 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[9px] font-bold text-[var(--accent)]">
                      {m.displayName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className="block truncate">{m.displayName}</span>
                      {m.department && <span className="block text-[9px] text-[var(--text-muted)]">{m.department}</span>}
                    </div>
                    <UserPlus className="h-3 w-3 text-[#22C55E] shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 scrollbar-thin">
        {channelMembers.map((m, i) => {
          const isCreator = channel.createdBy === m.id;
          const isChannelAdmin = channel.admins?.includes(m.id);
          const isSelf = m.id === userId;

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-md hover:bg-[var(--bg-hover)] group transition"
            >
              <div className="w-8 h-8 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0">
                {m.displayName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">{m.displayName}</span>
                  {isSelf && <span className="text-[9px] text-[var(--text-muted)]">{t('chat.you')}</span>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isCreator && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] font-semibold flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5" />{t('chat.owner')}
                    </span>
                  )}
                  {isChannelAdmin && !isCreator && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-semibold flex items-center gap-0.5">
                      <Shield className="h-2.5 w-2.5" />{t('chat.admin')}
                    </span>
                  )}
                  {m.department && <span className="text-[9px] text-[var(--text-muted)]">{m.department}</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                {!isSelf && (
                  <motion.button whileTap={{ scale: 0.85 }}
                    onClick={() => onStartDM(m.id)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] rounded-lg transition" title={t('chat.directMessageAction')}>
                    <MessageCircle className="h-3.5 w-3.5" />
                  </motion.button>
                )}
                {canManage && !isCreator && !isSelf && (
                  <>
                    <motion.button whileTap={{ scale: 0.85 }}
                      onClick={() => onToggleAdmin(m.id)}
                      className={`p-1.5 rounded-lg transition ${isChannelAdmin ? 'text-blue-400 hover:text-[var(--text-muted)]' : 'text-[var(--text-muted)] hover:text-blue-400'}`}
                      title={isChannelAdmin ? t('chat.removeAdmin') : t('chat.makeAdmin')}>
                      {isChannelAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.85 }}
                      onClick={() => { if (confirm(t('chat.removeConfirm', { name: m.displayName }))) onRemove(m.id); }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition" title={t('chat.removeAction')}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
