'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Globe, Users, Lock, UserPlus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import type { WhiteboardPermissions, WhiteboardVisibility } from './constants';

interface Props {
  open: boolean;
  onClose: () => void;
  permissions: WhiteboardPermissions;
  onSave: (permissions: WhiteboardPermissions) => void;
  createdBy: string;
}

const VISIBILITY_OPTIONS: { value: WhiteboardVisibility; icon: any; labelEs: string; labelEn: string; descEs: string; descEn: string }[] = [
  { value: 'workspace', icon: Globe, labelEs: 'Workspace', labelEn: 'Workspace', descEs: 'Todos en la organización pueden ver', descEn: 'Everyone in the org can view' },
  { value: 'space', icon: Users, labelEs: 'Space', labelEn: 'Space', descEs: 'Solo miembros del space', descEn: 'Only space members' },
  { value: 'private', icon: Lock, labelEs: 'Privado', labelEn: 'Private', descEs: 'Solo personas específicas', descEn: 'Only specific people' },
];

export default function WhiteboardPermissionsModal({ open, onClose, permissions, onSave, createdBy }: Props) {
  const { lang } = useI18n();
  const { allMembers } = useAuth();

  const [visibility, setVisibility] = useState<WhiteboardVisibility>(permissions.visibility);
  const [viewers, setViewers] = useState<string[]>(permissions.viewers);
  const [editors, setEditors] = useState<string[]>(permissions.editors);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'viewer' | 'editor'>('viewer');

  const handleSave = () => {
    onSave({ visibility, viewers, editors });
    onClose();
  };

  const handleAddUser = () => {
    if (!addUserId) return;
    if (addRole === 'editor') {
      if (!editors.includes(addUserId)) setEditors([...editors, addUserId]);
      // Remove from viewers if was there
      setViewers(viewers.filter(id => id !== addUserId));
    } else {
      if (!viewers.includes(addUserId)) setViewers([...viewers, addUserId]);
    }
    setAddUserId('');
  };

  const handleRemoveUser = (userId: string) => {
    setViewers(viewers.filter(id => id !== userId));
    setEditors(editors.filter(id => id !== userId));
  };

  const getMemberName = (userId: string) => {
    const m = allMembers.find((m: any) => m.userId === userId);
    return m?.displayName || m?.email || userId;
  };

  const allUserIds = [...new Set([...viewers, ...editors])];
  const availableMembers = allMembers.filter((m: any) =>
    m.active !== false && !allUserIds.includes(m.userId) && m.userId !== createdBy
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md bg-[var(--bg-elevated)] rounded-2xl shadow-xl border border-[var(--border-subtle)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
                {lang === 'es' ? 'Permisos del whiteboard' : 'Whiteboard permissions'}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
              <X className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Visibility selector */}
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {lang === 'es' ? 'Visibilidad' : 'Visibility'}
              </label>
              <div className="space-y-1.5">
                {VISIBILITY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = visibility === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setVisibility(opt.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition text-left ${
                        isSelected
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent)]/30 text-[var(--accent)]'
                          : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium">{lang === 'es' ? opt.labelEs : opt.labelEn}</p>
                        <p className="text-[11px] opacity-70">{lang === 'es' ? opt.descEs : opt.descEn}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* People list (show for space and private) */}
            {(visibility === 'space' || visibility === 'private') && (
              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {lang === 'es' ? 'Personas' : 'People'}
                </label>

                {/* Add user */}
                <div className="flex items-center gap-2">
                  <select
                    value={addUserId}
                    onChange={e => setAddUserId(e.target.value)}
                    className="flex-1 h-8 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                  >
                    <option value="">{lang === 'es' ? 'Agregar persona...' : 'Add person...'}</option>
                    {availableMembers.map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.displayName || m.email}</option>
                    ))}
                  </select>
                  <select
                    value={addRole}
                    onChange={e => setAddRole(e.target.value as 'viewer' | 'editor')}
                    className="h-8 px-2 rounded-lg bg-[var(--bg-secondary)] text-[12px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                  >
                    <option value="viewer">{lang === 'es' ? 'Ver' : 'View'}</option>
                    <option value="editor">{lang === 'es' ? 'Editar' : 'Edit'}</option>
                  </select>
                  <button
                    onClick={handleAddUser}
                    disabled={!addUserId}
                    className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium disabled:opacity-50 hover:opacity-90 transition"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* User list */}
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {/* Creator (always shown, non-removable) */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)]">
                    <span className="text-[13px] text-[var(--text-primary)] flex-1 truncate">{getMemberName(createdBy)}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                      {lang === 'es' ? 'Propietario' : 'Owner'}
                    </span>
                  </div>

                  {allUserIds.map(userId => {
                    const isEditor = editors.includes(userId);
                    return (
                      <div key={userId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] group">
                        <span className="text-[13px] text-[var(--text-primary)] flex-1 truncate">{getMemberName(userId)}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          isEditor ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {isEditor ? (lang === 'es' ? 'Editor' : 'Editor') : (lang === 'es' ? 'Viewer' : 'Viewer')}
                        </span>
                        <button
                          onClick={() => handleRemoveUser(userId)}
                          className="p-1 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition">
              {lang === 'es' ? 'Guardar' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
