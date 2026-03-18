'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export interface GoalFolderDef {
  id: string;
  name: string;
  color: string;
}

const FOLDER_COLORS = [
  '#7B68EE', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#F97316', '#8B5CF6', '#14B8A6',
];

interface Props {
  folders: GoalFolderDef[];
  onFoldersChange: (folders: GoalFolderDef[]) => void;
  /** Number of goals per folder name */
  goalCounts: Record<string, number>;
}

export default function GoalFolderManager({ folders, onFoldersChange, goalCounts }: Props) {
  const { t, lang } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) + '_' + Date.now().toString(36);
    onFoldersChange([...folders, { id, name: newName.trim(), color: newColor }]);
    setNewName('');
    setNewColor(FOLDER_COLORS[(folders.length + 1) % FOLDER_COLORS.length]);
    setShowCreate(false);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    onFoldersChange(folders.map(f => f.id === id ? { ...f, name: editName.trim() } : f));
    setEditId(null);
    setEditName('');
  };

  const handleDelete = (id: string) => {
    onFoldersChange(folders.filter(f => f.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-[var(--text-muted)]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            {lang === 'es' ? 'Carpetas de objetivos' : 'Goal Folders'}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">({folders.length})</span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition"
        >
          <Plus className="h-3.5 w-3.5" />
          {lang === 'es' ? 'Nueva carpeta' : 'New folder'}
        </button>
      </div>

      {/* Create inline */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              {/* Color picker */}
              <div className="flex gap-1 shrink-0">
                {FOLDER_COLORS.slice(0, 5).map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder={lang === 'es' ? 'Nombre de carpeta...' : 'Folder name...'}
                autoFocus
                className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <button onClick={handleCreate} className="p-1 text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-md">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setShowCreate(false)} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-md">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder list */}
      {folders.length === 0 && !showCreate ? (
        <p className="text-[12px] text-[var(--text-muted)] py-2">
          {lang === 'es' ? 'Sin carpetas. Los objetivos se mostrarán sin agrupar.' : 'No folders. Goals will show ungrouped.'}
        </p>
      ) : (
        <div className="space-y-1">
          {folders.map(folder => {
            const count = goalCounts[folder.name] || 0;
            return (
              <div
                key={folder.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition group"
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: folder.color }} />

                {editId === folder.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(folder.id); if (e.key === 'Escape') setEditId(null); }}
                      autoFocus
                      className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
                    />
                    <button onClick={() => handleRename(folder.id)} className="p-1 text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-md">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-md">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] text-[var(--text-primary)] flex-1 truncate">{folder.name}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">{count}</span>

                    {deleteConfirm === folder.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(folder.id)} className="px-2 py-0.5 text-[11px] text-red-400 bg-red-500/10 rounded-md hover:bg-red-500/20">
                          {lang === 'es' ? 'Sí' : 'Yes'}
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 text-[11px] text-[var(--text-muted)] bg-[var(--bg-hover)] rounded-md">
                          {lang === 'es' ? 'No' : 'No'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => { setEditId(folder.id); setEditName(folder.name); }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(folder.id)}
                          className="p-1 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-md"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
