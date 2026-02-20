'use client';
import { useState } from 'react';
import { X, Hash, Lock, Check, Users } from 'lucide-react';

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
    onCreate({
      name: name.trim(),
      description: description.trim(),
      type,
      members: selectedMembers,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#0C1017] border border-[#1F2937] rounded-2xl shadow-2xl anim-slide overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#1F2937]/60">
          <h2 className="text-lg font-bold text-white">Create Channel</h2>
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Channel Name *</label>
            <input value={name} onChange={e => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
              placeholder="e.g. general, marketing-updates"
              autoFocus className="input-dark" onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel about?" className="input-dark" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Type</label>
            <div className="flex gap-2">
              <button onClick={() => setType('public')}
                className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border transition ${type === 'public' ? 'bg-[#D4A843]/10 border-[#D4A843]/20 text-[#D4A843]' : 'bg-[#111827] border-[#1F2937] text-gray-500 hover:border-gray-600'}`}>
                <Hash className="h-5 w-5" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Public</p>
                  <p className="text-[10px] opacity-60">Anyone can join and see messages</p>
                </div>
              </button>
              <button onClick={() => setType('private')}
                className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border transition ${type === 'private' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-[#111827] border-[#1F2937] text-gray-500 hover:border-gray-600'}`}>
                <Lock className="h-5 w-5" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Private</p>
                  <p className="text-[10px] opacity-60">Only invited members can access</p>
                </div>
              </button>
            </div>
          </div>

          {/* Members (especially for private) */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">
              {type === 'private' ? 'Add Members *' : 'Add Members (optional)'}
            </label>
            <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members..." className="input-dark h-9 text-xs mb-2" />
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-[#1F2937] bg-[#111827] p-2">
              {filteredMembers.map(m => {
                const sel = selectedMembers.includes(m.id);
                return (
                  <button key={m.id} onClick={() => toggleMember(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition ${sel ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-400 hover:bg-white/[0.02] hover:text-gray-300'}`}>
                    <div className="w-6 h-6 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[9px] font-bold text-[#D4A843] shrink-0">
                      {m.displayName?.[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-left">{m.displayName}</span>
                    {m.department && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1F2937] text-gray-600">{m.department}</span>}
                    {sel && <Check className="h-3.5 w-3.5 text-[#D4A843]" />}
                  </button>
                );
              })}
            </div>
            {selectedMembers.length > 0 && (
              <p className="text-[10px] text-gray-600 mt-1.5">{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-[#1F2937]/60">
          <button onClick={onClose} className="px-5 h-10 rounded-xl border border-[#1F2937] text-sm text-gray-400">Cancel</button>
          <button onClick={submit} disabled={!name.trim()} className="px-6 h-10 rounded-xl btn-gold text-sm disabled:opacity-40">Create</button>
        </div>
      </div>
    </div>
  );
}