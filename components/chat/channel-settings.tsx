'use client';
import { useState } from 'react';
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
    <div className="w-[340px] shrink-0 bg-[#0C1017] border-l border-[#1F2937]/60 flex flex-col h-full overflow-hidden anim-slide">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1F2937]/60">
        <h3 className="text-sm font-bold text-white">Channel Settings</h3>
        <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Channel Name</label>
          <input value={name} onChange={e => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())} className="input-dark" disabled={!canManage} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl bg-[#111827] border border-[#1F2937] text-sm text-gray-300 resize-y outline-none focus:border-[#D4A843]/30" disabled={!canManage} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Type</label>
          <div className="flex gap-2">
            <button onClick={() => canManage && setType('public')} className={`flex-1 flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition ${type === 'public' ? 'bg-[#D4A843]/10 border-[#D4A843]/20 text-[#D4A843]' : 'bg-[#111827] border-[#1F2937] text-gray-500'}`}>
              <Hash className="h-4 w-4" /> Public
            </button>
            <button onClick={() => canManage && setType('private')} className={`flex-1 flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition ${type === 'private' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-[#111827] border-[#1F2937] text-gray-500'}`}>
              <Lock className="h-4 w-4" /> Private
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl bg-[#111827] border border-[#1F2937]/60 p-4 space-y-2 text-xs text-gray-500">
          <div className="flex justify-between"><span>Created by</span><span className="text-gray-300">{channel.createdByName || '—'}</span></div>
          <div className="flex justify-between"><span>Members</span><span className="text-gray-300">{(channel.members || []).length}</span></div>
          <div className="flex justify-between"><span>Pinned</span><span className="text-gray-300">{(channel.pinnedMessages || []).length}</span></div>
          {channel.createdAt?.toDate && <div className="flex justify-between"><span>Created</span><span className="text-gray-300">{channel.createdAt.toDate().toLocaleDateString()}</span></div>}
        </div>

        {canManage && (
          <button onClick={() => onUpdate({ name, description, type })} className="w-full h-10 rounded-xl btn-gold text-sm flex items-center justify-center gap-2">
            <Save className="h-4 w-4" /> Save Changes
          </button>
        )}

        {/* Danger zone */}
        {canManage && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" /><span className="text-xs font-semibold text-red-400">Danger Zone</span></div>
            <button onClick={onArchive} className="w-full h-9 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400 flex items-center justify-center gap-2 hover:bg-amber-500/10 transition">
              <Archive className="h-3.5 w-3.5" /> Archive Channel
            </button>
            <button onClick={onDelete} className="w-full h-9 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 flex items-center justify-center gap-2 hover:bg-red-500/10 transition">
              <Trash2 className="h-3.5 w-3.5" /> Delete Channel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}