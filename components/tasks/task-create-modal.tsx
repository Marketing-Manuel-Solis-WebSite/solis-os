'use client';
import { useState } from 'react';
import { X, Check, CheckSquare, Plus } from 'lucide-react';
import { STATUSES, PRIORITIES, TASK_TYPES, VISIBILITY, DEFAULT_CUSTOM_FIELDS } from './constants';

interface Props {
  members: any[];
  teams: any[];
  activeTeamId: string;
  onClose: () => void;
  onCreate: (data: any) => void;
}

export default function TaskCreateModal({ members, teams, activeTeamId, onClose, onCreate }: Props) {
  const [d, setD] = useState<any>({
    title: '', description: '', status: 'todo', priority: 'medium', type: 'task',
    assignees: [] as string[], tags: '', dueDate: '', startDate: '', timeEstimate: '',
    points: '', subtasks: [] as any[], visibility: 'team',
    teamId: activeTeamId === '__all__' ? '' : activeTeamId,
    customFields: {} as Record<string, any>,
  });
  const [newSub, setNewSub] = useState('');
  const [showFields, setShowFields] = useState(false);

  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const toggleAssignee = (id: string) => set('assignees', d.assignees.includes(id) ? d.assignees.filter((x: string) => x !== id) : [...d.assignees, id]);
  const addSub = () => { if (!newSub.trim()) return; set('subtasks', [...d.subtasks, { id: Date.now().toString(), title: newSub.trim(), done: false }]); setNewSub(''); };
  const setCustomField = (fid: string, val: any) => set('customFields', { ...d.customFields, [fid]: val });

  const submit = () => {
    if (!d.title.trim()) return;
    const out: any = {
      ...d,
      tags: d.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      points: d.points ? Number(d.points) : null,
      timeEstimate: d.timeEstimate ? Number(d.timeEstimate) : null,
    };
    if (d.dueDate) out.dueDate = new Date(d.dueDate);
    if (d.startDate) out.startDate = new Date(d.startDate);
    onCreate(out);
  };

  const activeFieldIds = Object.keys(d.customFields);
  const availableFields = DEFAULT_CUSTOM_FIELDS.filter(f => !activeFieldIds.includes(f.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-base)] rounded-xl shadow-modal anim-slide">
        {/* Header */}
        <div className="flex items-center justify-between p-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Nueva Tarea</h2>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <input value={d.title} onChange={e => set('title', e.target.value)} placeholder="Título de la tarea..." autoFocus
            className="w-full h-12 px-4 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] text-lg font-semibold placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30" />

          {/* Description */}
          <textarea value={d.description} onChange={e => set('description', e.target.value)} placeholder="Agrega descripción, contexto, instrucciones..." rows={3}
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 resize-y" />

          {/* Type + Status + Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Tipo</label>
              <div className="flex flex-wrap gap-1.5">
                {TASK_TYPES.map(t => (
                  <button key={t.id} onClick={() => set('type', t.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${d.type === t.id ? 'border text-[var(--text-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    style={d.type === t.id ? { backgroundColor: `${t.color}15`, borderColor: `${t.color}30`, color: t.color } : {}}>
                    <t.Icon className="h-3 w-3" />{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Estado</label>
              <select value={d.status} onChange={e => set('status', e.target.value)} className="select-dark w-full">
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Prioridad</label>
              <div className="flex gap-1">
                {PRIORITIES.map(p => (
                  <button key={p.id} onClick={() => set('priority', p.id)} title={p.label}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition ${d.priority === p.id ? 'ring-2 ring-white/20 scale-110' : 'opacity-50 hover:opacity-80'}`}>
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visibility + Department */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Visibilidad</label>
              <div className="flex gap-1.5">
                {VISIBILITY.map(v => (
                  <button key={v.id} onClick={() => set('visibility', v.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${d.visibility === v.id ? '' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-transparent hover:bg-[var(--bg-hover)]'}`}
                    style={d.visibility === v.id ? { backgroundColor: `${v.color}10`, borderColor: `${v.color}25`, color: v.color } : {}}>
                    <v.Icon className="h-3 w-3" />{v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Departamento</label>
              <select value={d.teamId} onChange={e => set('teamId', e.target.value)} className="select-dark w-full">
                <option value="">General</option>
                {teams.map((t: any) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Fecha Inicio</label>
              <input type="date" value={d.startDate} onChange={e => set('startDate', e.target.value)} className="input-dark h-9 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Fecha Límite</label>
              <input type="date" value={d.dueDate} onChange={e => set('dueDate', e.target.value)} className="input-dark h-9 text-sm" />
            </div>
          </div>

          {/* Time + Points */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Estimación (min)</label>
              <input type="number" value={d.timeEstimate} onChange={e => set('timeEstimate', e.target.value)} placeholder="60" className="input-dark h-9 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Puntos</label>
              <input type="number" value={d.points} onChange={e => set('points', e.target.value)} placeholder="5" className="input-dark h-9 text-sm" />
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Asignados</label>
            <div className="flex gap-2 flex-wrap">
              {members.map((m: any) => (
                <button key={m.id} onClick={() => toggleAssignee(m.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${d.assignees.includes(m.id) ? 'bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/20' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}>
                  <div className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[9px] font-bold">{m.displayName?.[0]?.toUpperCase()}</div>
                  {m.displayName}
                  {d.assignees.includes(m.id) && <Check className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Etiquetas (separadas por coma)</label>
            <input value={d.tags} onChange={e => set('tags', e.target.value)} placeholder="diseño, social, urgente" className="input-dark h-9 text-sm" />
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Subtareas</label>
            {d.subtasks.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-2 mb-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-secondary)] flex-1">{s.title}</span>
                <button onClick={() => set('subtasks', d.subtasks.filter((_: any, j: number) => j !== i))} className="text-[var(--text-muted)] hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="Agregar subtarea..." className="input-dark h-8 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && addSub()} />
              <button onClick={addSub} className="px-3 h-8 rounded-lg bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Agregar</button>
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Campos Personalizados</label>
              {availableFields.length > 0 && (
                <button onClick={() => setShowFields(!showFields)} className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Agregar campo
                </button>
              )}
            </div>
            {showFields && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl bg-[var(--bg-elevated)] shadow-card">
                {availableFields.map(f => (
                  <button key={f.id} onClick={() => { setCustomField(f.id, f.type === 'checkbox' ? false : ''); setShowFields(false); }}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200">
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {activeFieldIds.map(fid => {
              const def = DEFAULT_CUSTOM_FIELDS.find(f => f.id === fid);
              if (!def) return null;
              const val = d.customFields[fid];
              return (
                <div key={fid} className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-[var(--text-muted)] w-36 shrink-0">{def.label}</label>
                  {def.type === 'checkbox' ? (
                    <button onClick={() => setCustomField(fid, !val)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${val ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--border)]'}`}>
                      {val && <Check className="h-3 w-3 text-white" />}
                    </button>
                  ) : def.type === 'select' ? (
                    <select value={val || ''} onChange={e => setCustomField(fid, e.target.value)} className="select-dark h-8 text-xs flex-1">
                      <option value="">Seleccionar...</option>
                      {def.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={def.type === 'currency' || def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : def.type === 'email' ? 'email' : def.type === 'url' ? 'url' : def.type === 'phone' ? 'tel' : 'text'}
                      value={val || ''} onChange={e => setCustomField(fid, e.target.value)}
                      placeholder={def.label} className="input-dark h-8 text-xs flex-1"
                      {...(def.type === 'currency' ? { step: '0.01', min: '0' } : {})} />
                  )}
                  <button onClick={() => { const u = { ...d.customFields }; delete u[fid]; set('customFields', u); }}
                    className="text-[var(--text-muted)] hover:text-red-400 p-1"><X className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5">
          <button onClick={onClose} className="px-5 h-10 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200">Cancelar</button>
          <button onClick={submit} disabled={!d.title.trim()} className="px-6 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40">Crear Tarea</button>
        </div>
      </div>
    </div>
  );
}
