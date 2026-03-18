'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Merge, AlertTriangle, Loader2, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { CustomFieldDef, FieldScope } from '@/lib/custom-fields';

interface Props {
  open: boolean;
  onClose: () => void;
  fields: CustomFieldDef[];
  spaces: { id: string; name: string }[];
  lists: { id: string; name: string; spaceId: string }[];
  onMoveField: (fieldId: string, newScope: FieldScope, newScopeId: string | null, clearOutOfScope: boolean) => Promise<void>;
  onMergeFields: (sourceFieldId: string, targetFieldId: string, preserveExisting: boolean) => Promise<void>;
}

type Tab = 'move' | 'merge';

export default function FieldMoveMergeModal({ open, onClose, fields, spaces, lists, onMoveField, onMergeFields }: Props) {
  const { lang } = useI18n();
  const [tab, setTab] = useState<Tab>('move');

  // Move state
  const [moveFieldId, setMoveFieldId] = useState('');
  const [moveScope, setMoveScope] = useState<FieldScope>('org');
  const [moveScopeId, setMoveScopeId] = useState('');
  const [clearOutOfScope, setClearOutOfScope] = useState(true);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveResult, setMoveResult] = useState<string | null>(null);

  // Merge state
  const [sourceFieldId, setSourceFieldId] = useState('');
  const [targetFieldId, setTargetFieldId] = useState('');
  const [preserveExisting, setPreserveExisting] = useState(true);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const activeFields = fields.filter(f => !f.archived);
  const selectedMoveField = activeFields.find(f => f.id === moveFieldId);

  const handleMove = async () => {
    if (!moveFieldId || !moveScope) return;
    setMoveLoading(true);
    setMoveResult(null);
    try {
      await onMoveField(moveFieldId, moveScope, moveScope === 'org' ? null : moveScopeId, clearOutOfScope);
      setMoveResult(lang === 'es' ? 'Campo movido exitosamente' : 'Field moved successfully');
    } catch (err: any) {
      setMoveResult(`Error: ${err?.message || 'Unknown error'}`);
    }
    setMoveLoading(false);
  };

  const handleMerge = async () => {
    if (!sourceFieldId || !targetFieldId || sourceFieldId === targetFieldId) return;
    setMergeLoading(true);
    setMergeResult(null);
    try {
      await onMergeFields(sourceFieldId, targetFieldId, preserveExisting);
      setMergeResult(lang === 'es' ? 'Campos combinados exitosamente' : 'Fields merged successfully');
    } catch (err: any) {
      setMergeResult(`Error: ${err?.message || 'Unknown error'}`);
    }
    setMergeLoading(false);
  };

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
          className="w-full max-w-lg bg-[var(--bg-elevated)] rounded-2xl shadow-xl border border-[var(--border-subtle)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
              {lang === 'es' ? 'Mover / Combinar campos' : 'Move / Merge Fields'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
              <X className="h-4 w-4 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border-subtle)]">
            <button
              onClick={() => setTab('move')}
              className={`flex-1 px-4 py-3 text-[13px] font-medium transition flex items-center justify-center gap-2 ${
                tab === 'move' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <ArrowRight className="h-4 w-4" />
              {lang === 'es' ? 'Mover' : 'Move'}
            </button>
            <button
              onClick={() => setTab('merge')}
              className={`flex-1 px-4 py-3 text-[13px] font-medium transition flex items-center justify-center gap-2 ${
                tab === 'merge' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <Merge className="h-4 w-4" />
              {lang === 'es' ? 'Combinar' : 'Merge'}
            </button>
          </div>

          <div className="p-5 space-y-4">
            {tab === 'move' ? (
              <>
                {/* Move Field */}
                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Campo a mover' : 'Field to move'}
                  </label>
                  <select
                    value={moveFieldId}
                    onChange={e => setMoveFieldId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                  >
                    <option value="">{lang === 'es' ? 'Seleccionar campo...' : 'Select field...'}</option>
                    {activeFields.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.scope || 'org'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Nuevo scope' : 'New scope'}
                  </label>
                  <select
                    value={moveScope}
                    onChange={e => { setMoveScope(e.target.value as FieldScope); setMoveScopeId(''); }}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                  >
                    <option value="org">{lang === 'es' ? 'Organización (global)' : 'Organization (global)'}</option>
                    <option value="space">Space</option>
                    <option value="list">List</option>
                  </select>
                </div>

                {moveScope === 'space' && (
                  <div>
                    <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">Space</label>
                    <select
                      value={moveScopeId}
                      onChange={e => setMoveScopeId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                    >
                      <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                      {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {moveScope === 'list' && (
                  <div>
                    <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">List</label>
                    <select
                      value={moveScopeId}
                      onChange={e => setMoveScopeId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                    >
                      <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                      {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}

                {moveScope !== 'org' && selectedMoveField && (selectedMoveField.scope || 'org') !== moveScope && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] text-amber-300 font-medium">
                        {lang === 'es' ? 'Datos fuera de scope' : 'Out-of-scope data'}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        {lang === 'es'
                          ? 'Las tareas fuera del nuevo scope perderán el valor de este campo.'
                          : 'Tasks outside the new scope will lose this field\'s value.'}
                      </p>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input type="checkbox" checked={clearOutOfScope} onChange={e => setClearOutOfScope(e.target.checked)} className="rounded" />
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          {lang === 'es' ? 'Limpiar datos fuera de scope' : 'Clear out-of-scope data'}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {moveResult && (
                  <p className={`text-[12px] ${moveResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {moveResult}
                  </p>
                )}

                <button
                  onClick={handleMove}
                  disabled={moveLoading || !moveFieldId || (moveScope !== 'org' && !moveScopeId)}
                  className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2"
                >
                  {moveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {lang === 'es' ? 'Mover campo' : 'Move field'}
                </button>
              </>
            ) : (
              <>
                {/* Merge Fields */}
                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Campo origen (será archivado)' : 'Source field (will be archived)'}
                  </label>
                  <select
                    value={sourceFieldId}
                    onChange={e => setSourceFieldId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                  >
                    <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                    {activeFields.filter(f => f.id !== targetFieldId).map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="h-5 w-5 text-[var(--text-muted)] rotate-90" />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Campo destino (recibirá datos)' : 'Target field (will receive data)'}
                  </label>
                  <select
                    value={targetFieldId}
                    onChange={e => setTargetFieldId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]"
                  >
                    <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                    {activeFields.filter(f => f.id !== sourceFieldId).map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={preserveExisting} onChange={e => setPreserveExisting(e.target.checked)} className="rounded" />
                  <span className="text-[12px] text-[var(--text-secondary)]">
                    {lang === 'es' ? 'Preservar datos existentes en destino (no sobreescribir)' : 'Preserve existing target data (don\'t overwrite)'}
                  </span>
                </label>

                {mergeResult && (
                  <p className={`text-[12px] ${mergeResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {mergeResult}
                  </p>
                )}

                <button
                  onClick={handleMerge}
                  disabled={mergeLoading || !sourceFieldId || !targetFieldId || sourceFieldId === targetFieldId}
                  className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2"
                >
                  {mergeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                  {lang === 'es' ? 'Combinar campos' : 'Merge fields'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
