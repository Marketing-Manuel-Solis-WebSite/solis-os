'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Trash2, Archive, Hash, Lock, AlertTriangle } from 'lucide-react';

interface Props {
  channel: any;
  canManage: boolean;
  onClose: () => void;
  onUpdate: (data: any) => void;
  onDelete: () => void;
  onArchive: () => void;
}

export default function ChannelSettings({ channel, canManage, onClose, onUpdate, onDelete, onArchive }: Props) {
  const [name, setName] = useState(channel.name || '');
  const [description, setDescription] = useState(channel.description || '');
  const [type, setType] = useState(channel.type || 'public');

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-[340px] shrink-0 bg-[var(--bg-card)] border-l border-[var(--border)] flex flex-col h-full overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Channel Settings</h3>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition">
          <X className="h-4 w-4" />
        </motion.button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Channel Name</label>
          <input value={name} onChange={e => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())} className="input-dark" disabled={!canManage} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm text-[var(--text-secondary)] resize-y outline-none focus:border-[#D4A843]/40 transition-colors"
            disabled={!canManage} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Type</label>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => canManage && setType('public')}
              className={`flex-1 flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${type === 'public' ? 'bg-[#D4A843]/10 border-[#D4A843]/30 text-[#D4A843]' : 'bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-muted)]'}`}>
              <Hash className="h-4 w-4" /> Public
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => canManage && setType('private')}
              className={`flex-1 flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${type === 'private' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-muted)]'}`}>
              <Lock className="h-4 w-4" /> Private
            </motion.button>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl bg-[var(--bg-base)] border border-[var(--border)] p-4 space-y-2.5 text-xs text-[var(--text-muted)]">
          <div className="flex justify-between"><span>Created by</span><span className="text-[var(--text-secondary)] font-medium">{channel.createdByName || '—'}</span></div>
          <div className="flex justify-between"><span>Members</span><span className="text-[var(--text-secondary)] font-medium">{(channel.members || []).length}</span></div>
          <div className="flex justify-between"><span>Pinned</span><span className="text-[var(--text-secondary)] font-medium">{(channel.pinnedMessages || []).length}</span></div>
          {channel.createdAt?.toDate && (
            <div className="flex justify-between"><span>Created</span><span className="text-[var(--text-secondary)] font-medium">{channel.createdAt.toDate().toLocaleDateString()}</span></div>
          )}
        </div>

        {canManage && (
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
            onClick={() => onUpdate({ name, description, type })}
            className="w-full h-10 rounded-xl btn-gold text-sm flex items-center justify-center gap-2">
            <Save className="h-4 w-4" /> Save Changes
          </motion.button>
        )}

        {/* Danger zone */}
        {canManage && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Danger Zone</span>
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={onArchive}
              className="w-full h-9 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400 flex items-center justify-center gap-2 hover:bg-amber-500/10 transition">
              <Archive className="h-3.5 w-3.5" /> Archive Channel
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={onDelete}
              className="w-full h-9 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 flex items-center justify-center gap-2 hover:bg-red-500/10 transition">
              <Trash2 className="h-3.5 w-3.5" /> Delete Channel
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
