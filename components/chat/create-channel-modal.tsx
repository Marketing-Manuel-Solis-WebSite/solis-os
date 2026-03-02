'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hash, Lock, Check, Search } from 'lucide-react';

interface Props {
  members: any[];
  teams: any[];
  userId: string;
  onClose: () => void;
  onCreate: (data: any) => void;
}

export default function CreateChannelModal({ members, teams, userId, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredMembers = members.filter(m =>
    m.id !== userId && m.displayName?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim(), type, members: selectedMembers });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--bg-elevated)] rounded-xl shadow-modal overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Create Channel</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Set up a new conversation space</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition">
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {/* Name */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Channel Name *</label>
            <input value={name} onChange={e => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
              placeholder="e.g. general, marketing-updates"
              autoFocus className="input-dark" onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel about?" className="input-dark" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Type</label>
            <div className="flex gap-2">
              {[
                { value: 'public' as const, label: 'Public', desc: 'Anyone can join and see messages', icon: Hash, activeClass: 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30 text-[var(--accent)]' },
                { value: 'private' as const, label: 'Private', desc: 'Only invited members can access', icon: Lock, activeClass: 'bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-400' },
              ].map(opt => (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setType(opt.value)}
                  className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 ${type === opt.value ? opt.activeClass : 'bg-[var(--bg-base)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <opt.icon className="h-5 w-5" />
                  <div className="text-left">
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[10px] opacity-60">{opt.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Members */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">
              {type === 'private' ? 'Add Members *' : 'Add Members (optional)'}
            </label>

            {/* Selected chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedMembers.map(id => {
                  const m = members.find(mem => mem.id === id);
                  return (
                    <motion.span
                      key={id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent)]/10 text-xs text-[var(--accent)]"
                    >
                      <span className="w-4 h-4 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[8px] font-bold">
                        {m?.displayName?.[0]?.toUpperCase() || '?'}
                      </span>
                      {m?.displayName || id}
                      <button onClick={() => toggleMember(id)} className="hover:text-red-400 transition">
                        <X className="h-3 w-3" />
                      </button>
                    </motion.span>
                  );
                })}
              </div>
            )}

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--bg-base)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-all duration-200" />
            </div>

            <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-xl bg-[var(--bg-base)] shadow-card p-2 scrollbar-thin">
              {filteredMembers.map(m => {
                const sel = selectedMembers.includes(m.id);
                return (
                  <motion.button
                    key={m.id}
                    whileHover={{ x: 2 }}
                    onClick={() => toggleMember(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${sel ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${sel ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--accent)]/10 text-[var(--accent)]/70'}`}>
                      {m.displayName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className="block truncate">{m.displayName}</span>
                      {m.department && <span className="block text-[10px] text-[var(--text-muted)] truncate">{m.department}</span>}
                    </div>
                    {sel && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check className="h-4 w-4 text-[var(--accent)]" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5">
          <span className="text-xs text-[var(--text-muted)]">
            {selectedMembers.length > 0 ? `${selectedMembers.length} member${selectedMembers.length !== 1 ? 's' : ''} selected` : ''}
          </span>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={onClose}
              className="px-5 h-10 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200">
              Cancel
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={submit} disabled={!name.trim()}
              className="px-6 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40">
              Create Channel
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
