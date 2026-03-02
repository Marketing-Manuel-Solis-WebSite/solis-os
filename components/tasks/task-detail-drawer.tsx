'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Check, Trash2, Send, Hash, Plus, Paperclip, Calendar,
  ChevronDown, Download, ExternalLink, FileText,
  Image as ImageIcon, Video, Music, CheckSquare,
} from 'lucide-react';
import { getTaskComments, addTaskComment, getTaskActivity, addTaskActivity } from '@/lib/db';
import { uploadFile, isImageType, isVideoType, isAudioType, formatFileSize } from '@/lib/upload';
import { notifyMany } from '@/lib/notifications';
import { STATUSES, PRIORITIES, TASK_TYPES, VISIBILITY, DEFAULT_CUSTOM_FIELDS, ACCEPTED_FILES } from './constants';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  task: any;
  members: any[];
  teams: any[];
  userId: string;
  userName: string;
  canUpdate: boolean;
  canDelete: boolean;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: any) => void;
  onClose: () => void;
}

export default function TaskDetailDrawer({ task, members, teams, userId, userName, canUpdate, canDelete, onUpdate, onDelete, onClose }: Props) {
  const toast = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [tab, setTab] = useState<'comments' | 'activity' | 'details'>('comments');
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  const [editDesc, setEditDesc] = useState(false);
  const [descVal, setDescVal] = useState(task.description || '');
  const [newSub, setNewSub] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Sync task data on change
  useEffect(() => { setTitleVal(task.title); setDescVal(task.description || ''); }, [task.id, task.title, task.description]);

  // Load comments & activity
  const loadData = useCallback(async () => {
    try { setComments(await getTaskComments(task.id)); } catch { setComments([]); }
    try { setActivity(await getTaskActivity(task.id)); } catch { setActivity([]); }
  }, [task.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Computed
  const st = STATUSES.find(s => s.id === task.status) || STATUSES[0];
  const tp = TASK_TYPES.find(t => t.id === (task.type || 'task')) || TASK_TYPES[0];
  const due = task.dueDate?.toDate?.();
  const start = task.startDate?.toDate?.();
  const doneSub = (task.subtasks || []).filter((s: any) => s.done).length;
  const totalSub = (task.subtasks || []).length;
  const progress = totalSub > 0 ? Math.round(doneSub / totalSub * 100) : 0;
  const visConf = VISIBILITY.find(v => v.id === (task.visibility || 'team'));
  const taskTeam = teams.find((t: any) => t.id === task.teamId);
  const customFields = task.customFields || {};
  const activeFieldIds = Object.keys(customFields);
  const availableFields = DEFAULT_CUSTOM_FIELDS.filter(f => !activeFieldIds.includes(f.id));

  // Handlers
  const saveTitle = () => {
    if (titleVal.trim() && titleVal !== task.title && canUpdate) onUpdate(task.id, 'title', titleVal.trim(), task.title);
    setEditTitle(false);
  };
  const saveDesc = () => {
    if (canUpdate) onUpdate(task.id, 'description', descVal, task.description);
    setEditDesc(false);
  };
  const toggleSub = (i: number) => {
    if (!canUpdate) return;
    const u = [...(task.subtasks || [])];
    u[i] = { ...u[i], done: !u[i].done };
    onUpdate(task.id, 'subtasks', u);
  };
  const addSub = () => {
    if (!newSub.trim() || !canUpdate) return;
    onUpdate(task.id, 'subtasks', [...(task.subtasks || []), { id: Date.now().toString(), title: newSub.trim(), done: false }]);
    setNewSub('');
  };
  const removeSub = (i: number) => {
    if (!canUpdate) return;
    onUpdate(task.id, 'subtasks', (task.subtasks || []).filter((_: any, j: number) => j !== i));
  };

  // Custom fields
  const setCustomField = (fid: string, val: any) => onUpdate(task.id, 'customFields', { ...customFields, [fid]: val });
  const removeCustomField = (fid: string) => {
    const u = { ...customFields };
    delete u[fid];
    onUpdate(task.id, 'customFields', u);
  };

  // File upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !canUpdate) return;
    for (const file of Array.from(files)) {
      setUploading(true); setUploadPct(0);
      try {
        const result = await uploadFile(file, 'task-uploads', setUploadPct);
        const att = { id: Date.now().toString(), ...result, uploadedBy: userId, uploadedAt: new Date() };
        onUpdate(task.id, 'attachments', [...(task.attachments || []), att]);
      } catch (err: any) { toast.error('Error al subir archivo', err.message || 'Ocurrio un error al subir el archivo.'); }
      setUploading(false);
    }
  };
  const removeAttachment = (attId: string) => {
    if (!canUpdate) return;
    onUpdate(task.id, 'attachments', (task.attachments || []).filter((a: any) => a.id !== attId));
  };

  // Comments with @mentions
  const handleCommentChange = (val: string) => {
    setNewComment(val);
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (member: any) => {
    const beforeAt = newComment.replace(/@\w*$/, '');
    setNewComment(`${beforeAt}@${member.displayName.split(' ')[0]} `);
    if (!mentionIds.includes(member.id)) setMentionIds([...mentionIds, member.id]);
    setMentionOpen(false);
    commentRef.current?.focus();
  };

  const filteredMentionMembers = members.filter(m =>
    m.id !== userId && m.displayName?.toLowerCase().includes(mentionFilter)
  );

  const postComment = async () => {
    if (!newComment.trim()) return;
    await addTaskComment(task.id, { text: newComment.trim(), authorId: userId, authorName: userName, mentions: mentionIds });
    // Notify mentioned users
    if (mentionIds.length > 0) {
      notifyMany(mentionIds, {
        type: 'task_mentioned',
        title: `${userName} te mencionó en una tarea`,
        message: newComment.trim().slice(0, 80),
        entityType: 'task',
        entityId: task.id,
        entityUrl: '/app/tasks',
        actorId: userId,
        actorName: userName,
      }).catch(() => {});
    }
    setNewComment('');
    setMentionIds([]);
    setComments(await getTaskComments(task.id));
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // File icon helper
  const getFileIcon = (type: string) => {
    if (isImageType(type)) return ImageIcon;
    if (isVideoType(type)) return Video;
    if (isAudioType(type)) return Music;
    return FileText;
  };

  return (
    <div className="w-[480px] shrink-0 bg-[var(--bg-base)] shadow-panel flex flex-col h-full overflow-hidden anim-slide">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <tp.Icon className="h-4 w-4 shrink-0" style={{ color: tp.color }} />
          <span className="text-sm font-semibold text-[var(--text-muted)] uppercase">{tp.label}</span>
          {visConf && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1 font-medium shrink-0" style={{ backgroundColor: `${visConf.color}10`, color: visConf.color }}>
              <visConf.Icon className="h-2.5 w-2.5" />{visConf.label}
            </span>
          )}
          {taskTeam && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0" style={{ backgroundColor: `${taskTeam.color}15`, color: taskTeam.color }}>
              {taskTeam.icon} {taskTeam.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(canDelete || task.createdBy === userId) && (
            <button onClick={() => onDelete(task)} className="p-2 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition"><Trash2 className="h-4 w-4" /></button>
          )}
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-4">
          {/* Title */}
          {editTitle && canUpdate ? (
            <div className="flex gap-2">
              <input value={titleVal} onChange={e => setTitleVal(e.target.value)}
                className="input-dark flex-1 text-lg font-bold" autoFocus onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditTitle(false); setTitleVal(task.title); } }} />
              <button onClick={saveTitle} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setEditTitle(false); setTitleVal(task.title); }} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] rounded-lg"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <h2 className={`text-xl font-bold text-[var(--text-primary)] ${canUpdate ? 'cursor-pointer hover:text-[var(--accent)]' : ''} transition`} onClick={() => canUpdate && setEditTitle(true)}>
              {task.title}
            </h2>
          )}

          {/* Status + Priority */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Estado</label>
              <select value={task.status} onChange={e => canUpdate && onUpdate(task.id, 'status', e.target.value, task.status)} disabled={!canUpdate}
                className="w-full h-9 px-3 rounded-xl text-sm font-semibold border cursor-pointer" style={{ backgroundColor: `${st.color}10`, borderColor: `${st.color}25`, color: st.color }}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Prioridad</label>
              <div className="flex gap-1">
                {PRIORITIES.map(p => (
                  <button key={p.id} onClick={() => canUpdate && onUpdate(task.id, 'priority', p.id, task.priority)} title={p.label} disabled={!canUpdate}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition ${task.priority === p.id ? 'ring-2 ring-white/20 bg-white/5 scale-105' : 'opacity-40 hover:opacity-70'}`}>
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visibility + Team */}
          {canUpdate && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Visibilidad</label>
                <select value={task.visibility || 'team'} onChange={e => onUpdate(task.id, 'visibility', e.target.value, task.visibility)} className="select-dark w-full h-8 text-sm">
                  {VISIBILITY.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Departamento</label>
                <select value={task.teamId || ''} onChange={e => onUpdate(task.id, 'teamId', e.target.value, task.teamId)} className="select-dark w-full h-8 text-sm">
                  <option value="">General</option>
                  {teams.map((t: any) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Assignees */}
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Asignados</label>
            <div className="flex gap-1.5 flex-wrap">
              {members.map((m: any) => {
                const assigned = task.assignees?.includes(m.id);
                return (
                  <button key={m.id} disabled={!canUpdate}
                    onClick={() => { const n = assigned ? task.assignees.filter((x: string) => x !== m.id) : [...(task.assignees || []), m.id]; onUpdate(task.id, 'assignees', n, task.assignees); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${assigned ? 'bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/20' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}>
                    <div className="w-4 h-4 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[8px] font-bold">{m.displayName?.[0]?.toUpperCase()}</div>
                    {m.displayName?.split(' ')[0]}{assigned && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Inicio</label>
              <input type="date" value={start ? start.toISOString().split('T')[0] : ''} disabled={!canUpdate}
                onChange={e => canUpdate && onUpdate(task.id, 'startDate', e.target.value ? new Date(e.target.value) : null)} className="input-dark h-8 text-sm w-full" />
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Fecha Límite</label>
              <input type="date" value={due ? due.toISOString().split('T')[0] : ''} disabled={!canUpdate}
                onChange={e => canUpdate && onUpdate(task.id, 'dueDate', e.target.value ? new Date(e.target.value) : null)} className="input-dark h-8 text-sm w-full" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Descripción</label>
            {editDesc && canUpdate ? (
              <div>
                <textarea value={descVal} onChange={e => setDescVal(e.target.value)} rows={5} autoFocus
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30" />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveDesc} className="px-3 h-7 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-[13px]">Guardar</button>
                  <button onClick={() => { setEditDesc(false); setDescVal(task.description || ''); }} className="px-3 h-7 rounded-lg bg-[var(--bg-tertiary)] text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-all duration-200">Cancelar</button>
                </div>
              </div>
            ) : (
              <div onClick={() => canUpdate && setEditDesc(true)}
                className={`min-h-[50px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] ${canUpdate ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''} transition-all duration-200`}>
                {task.description ? <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{task.description}</p> : <p className="text-sm text-[var(--text-muted)]">{canUpdate ? 'Clic para agregar descripción...' : 'Sin descripción'}</p>}
              </div>
            )}
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Campos Personalizados</label>
              {canUpdate && availableFields.length > 0 && (
                <button onClick={() => setShowFieldPicker(!showFieldPicker)} className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              )}
            </div>
            {showFieldPicker && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl bg-[var(--bg-elevated)] shadow-card anim-slide">
                {availableFields.map(f => (
                  <button key={f.id} onClick={() => { setCustomField(f.id, f.type === 'checkbox' ? false : ''); setShowFieldPicker(false); }}
                    className="text-sm px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200">
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {activeFieldIds.map(fid => {
              const def = DEFAULT_CUSTOM_FIELDS.find(f => f.id === fid);
              if (!def) return null;
              const val = customFields[fid];
              return (
                <div key={fid} className="flex items-center gap-2 mb-2">
                  <label className="text-sm text-[var(--text-muted)] w-32 shrink-0 truncate">{def.label}</label>
                  {def.type === 'checkbox' ? (
                    <button onClick={() => canUpdate && setCustomField(fid, !val)} disabled={!canUpdate}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${val ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--border)]'}`}>
                      {val && <Check className="h-3 w-3 text-white" />}
                    </button>
                  ) : def.type === 'select' ? (
                    <select value={val || ''} onChange={e => canUpdate && setCustomField(fid, e.target.value)} disabled={!canUpdate} className="select-dark h-8 text-sm flex-1">
                      <option value="">Seleccionar...</option>
                      {def.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : def.type === 'currency' ? (
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-sm text-[var(--text-muted)]">$</span>
                      <input type="number" step="0.01" min="0" value={val || ''} disabled={!canUpdate}
                        onChange={e => canUpdate && setCustomField(fid, e.target.value)} className="input-dark h-8 text-sm flex-1" />
                    </div>
                  ) : (
                    <input type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : def.type === 'email' ? 'email' : def.type === 'url' ? 'url' : def.type === 'phone' ? 'tel' : 'text'}
                      value={val || ''} disabled={!canUpdate}
                      onChange={e => canUpdate && setCustomField(fid, e.target.value)}
                      placeholder={def.label} className="input-dark h-8 text-sm flex-1" />
                  )}
                  {canUpdate && (
                    <button onClick={() => removeCustomField(fid)} className="text-[var(--text-muted)] hover:text-red-400 p-1"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Subtareas</label>
              {totalSub > 0 && <span className="text-[12px] text-[var(--text-muted)]">{doneSub}/{totalSub} · {progress}%</span>}
            </div>
            {totalSub > 0 && (
              <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] mb-3 overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            )}
            {(task.subtasks || []).map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-elevated)] group">
                <button onClick={() => toggleSub(i)} disabled={!canUpdate}
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${s.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--border)]'}`}>
                  {s.done && <Check className="h-2.5 w-2.5" />}
                </button>
                <span className={`text-sm flex-1 ${s.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>{s.title}</span>
                {canUpdate && (
                  <button onClick={() => removeSub(i)} className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {canUpdate && (
              <div className="flex gap-2 mt-2">
                <input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="Agregar subtarea..." className="input-dark h-8 text-sm flex-1" onKeyDown={e => e.key === 'Enter' && addSub()} />
                <button onClick={addSub} className="px-3 h-8 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">+</button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Etiquetas</label>
            <div className="flex gap-1.5 flex-wrap">
              {(task.tags || []).map((tag: string) => (
                <span key={tag} className="text-[13px] px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] flex items-center gap-1">
                  <Hash className="h-3 w-3" />{tag}
                  {canUpdate && <button onClick={() => onUpdate(task.id, 'tags', task.tags.filter((t: string) => t !== tag))} className="text-[var(--text-muted)] hover:text-red-400"><X className="h-3 w-3" /></button>}
                </span>
              ))}
              {(task.tags || []).length === 0 && <span className="text-sm text-[var(--text-muted)]">Sin etiquetas</span>}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Archivos Adjuntos</label>
              {canUpdate && (
                <button onClick={() => fileRef.current?.click()} className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Adjuntar
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept={ACCEPTED_FILES} multiple hidden onChange={e => handleFileUpload(e.target.files)} />

            {uploading && (
              <div className="mb-3 p-3 rounded-xl bg-[var(--bg-elevated)] shadow-card">
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1.5">
                  <Paperclip className="h-3 w-3 animate-pulse" /> Subiendo... {uploadPct}%
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {(task.attachments || []).map((att: any) => {
                const FileIcon = getFileIcon(att.type);
                const isImg = isImageType(att.type);
                const isVid = isVideoType(att.type);
                const isAud = isAudioType(att.type);

                return (
                  <div key={att.id} className="rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden group">
                    {/* Preview */}
                    {isImg && (
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={att.url} alt={att.name} className="w-full max-h-48 object-cover hover:opacity-90 transition" />
                      </a>
                    )}
                    {isVid && (
                      <video src={att.url} controls className="w-full max-h-48" />
                    )}
                    {isAud && (
                      <div className="p-3"><audio src={att.url} controls className="w-full" /></div>
                    )}
                    {/* Info bar */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      <FileIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      <span className="text-sm text-[var(--text-secondary)] truncate flex-1">{att.name}</span>
                      <span className="text-[12px] text-[var(--text-muted)] shrink-0">{formatFileSize(att.size)}</span>
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {canUpdate && (
                        <button onClick={() => removeAttachment(att.id)} className="p-1 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {(task.attachments || []).length === 0 && !uploading && (
                <p className="text-sm text-[var(--text-muted)] text-center py-2">Sin archivos adjuntos</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs: Comments / Activity / Details */}
        <div>
          <div className="flex px-5">
            {([
              { key: 'comments', label: `Comentarios (${comments.length})` },
              { key: 'activity', label: 'Actividad' },
              { key: 'details', label: 'Detalles' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === t.key ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Comments tab */}
            {tab === 'comments' && (
              <div>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {comments.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-4">Sin comentarios aún.</p>}
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-[12px] font-bold text-[var(--accent)] shrink-0">{c.authorName?.[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{c.authorName}</span>
                          <span className="text-[12px] text-[var(--text-muted)]">{c.createdAt?.toDate?.()?.toLocaleString?.('es-MX') || ''}</span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5 break-words">
                          {c.text?.split(/(@\w+)/g).map((part: string, i: number) =>
                            part.startsWith('@') ? <span key={i} className="text-[var(--accent)] font-medium">{part}</span> : part
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
                {/* Comment input with @mentions */}
                <div className="relative">
                  {mentionOpen && filteredMentionMembers.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-elevated)] rounded-xl shadow-dropdown max-h-40 overflow-y-auto z-10">
                      {filteredMentionMembers.map(m => (
                        <button key={m.id} onClick={() => insertMention(m)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] text-left transition">
                          <div className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[9px] font-bold text-[var(--accent)]">{m.displayName?.[0]?.toUpperCase()}</div>
                          <span className="text-sm text-[var(--text-secondary)]">{m.displayName}</span>
                          <span className="text-[12px] text-[var(--text-muted)]">{m.title || m.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input ref={commentRef} value={newComment} onChange={e => handleCommentChange(e.target.value)}
                      placeholder="Escribe un comentario... usa @ para mencionar"
                      className="input-dark h-9 text-sm flex-1" onKeyDown={e => { if (e.key === 'Enter' && !mentionOpen) postComment(); if (e.key === 'Escape') setMentionOpen(false); }} />
                    <button onClick={postComment} className="h-9 px-4 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm"><Send className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Activity tab */}
            {tab === 'activity' && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activity.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-4">Sin actividad.</p>}
                {activity.map(a => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[var(--accent)] font-medium">{a.actorName}</span>{' '}
                      <span className="text-[var(--text-muted)]">{a.action}</span>
                      {a.field && <span className="text-[var(--text-muted)]"> {a.field}</span>}
                      {a.from && <span className="text-red-400/60 line-through ml-1">{a.from}</span>}
                      {a.to && <span className="text-emerald-400 ml-1">{a.to}</span>}
                      <span className="text-[var(--text-muted)]/40 ml-2">{a.createdAt?.toDate?.()?.toLocaleString?.('es-MX') || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Details tab */}
            {tab === 'details' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Tipo</span>
                  <span className="text-[var(--text-secondary)] flex items-center gap-1"><tp.Icon className="h-3 w-3" style={{ color: tp.color }} />{tp.label}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Visibilidad</span>
                  <span className="text-[var(--text-secondary)] flex items-center gap-1">{visConf && <><visConf.Icon className="h-3 w-3" style={{ color: visConf.color }} />{visConf.label}</>}</span>
                </div>
                {taskTeam && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Departamento</span>
                    <span className="text-[var(--text-secondary)]">{taskTeam.icon} {taskTeam.name}</span>
                  </div>
                )}
                {task.timeEstimate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Estimación</span>
                    <span className="text-[var(--text-secondary)]">{task.timeEstimate}m</span>
                  </div>
                )}
                {task.points && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Puntos</span>
                    <span className="text-[var(--text-secondary)]">{task.points}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Creado</span>
                  <span className="text-[var(--text-secondary)]">{task.createdAt?.toDate?.()?.toLocaleDateString?.('es-MX') || '—'}</span>
                </div>
                {task.updatedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Actualizado</span>
                    <span className="text-[var(--text-secondary)]">{task.updatedAt?.toDate?.()?.toLocaleDateString?.('es-MX') || '—'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Creado por</span>
                  <span className="text-[var(--text-secondary)]">{members.find(m => m.id === task.createdBy)?.displayName || task.createdBy}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
