'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Trash2, Send, Hash, Plus, Paperclip, Calendar,
  ChevronDown, Download, ExternalLink, FileText,
  Image as ImageIcon, Video, Music, CheckSquare,
  Maximize2, Minimize2, GitBranch, Eye, MessageSquare,
  Clock, User, Activity, Repeat, Sparkles, Loader2, ArrowRightLeft,
} from 'lucide-react';
import { getTaskComments, addTaskComment, getTaskActivity, addTaskActivity } from '@/lib/db';
import { uploadFile, isImageType, isVideoType, isAudioType, formatFileSize } from '@/lib/upload';
import { notifyMany } from '@/lib/notifications';
import EntityRelations from '@/components/shared/entity-relations';
import RecurrencePicker from './recurrence-picker';
import { getRecurrenceDescription } from '@/lib/recurrence';
import {
  STATUSES, PRIORITIES, TASK_TYPES, VISIBILITY, ACCEPTED_FILES,
  getStatusConfig, getPriorityConfig, getTypeConfig, getVisibilityConfig,
  getSubtaskProgress,
} from './constants';
import { useCustomFieldDefs } from '@/lib/hooks/use-custom-field-defs';
import { getFieldsByGroup } from '@/lib/custom-fields';
import CustomFieldRenderer from './custom-field-renderer';
import { useToast } from '@/components/notifications/toast-provider';
import { validateCustomFieldValues } from '@/lib/validation';
import { useFeatureFlag } from '@/lib/feature-flags';
import { FeatureGate } from '@/components/shared/feature-gate';
import AIDecomposePanel from './ai-decompose-panel';
import AIAssigneeSuggestions from './ai-assignee-suggestions';
import TaskGithubLinks from './task-github-links';
import FavoriteButton from '@/components/shared/favorite-button';
import SubtaskList from './subtask-list';
import { getSubtasks, rollupProgress, convertLegacySubtasks } from '@/lib/subtask-ops';

/* ============================================
   PROPS
   ============================================ */
interface Props {
  task: any;
  members: any[];
  teams: any[];
  lists?: { id?: string; name: string }[];
  userId: string;
  userName: string;
  canUpdate: boolean;
  canDelete: boolean;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: any) => void;
  onClose: () => void;
}

/* ============================================
   SECTION HEADER (collapsible)
   ============================================ */
function SectionHeader({ id, label, count, collapsed, onToggle }: {
  id: string;
  label: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-2 py-3 text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] font-semibold hover:text-[var(--text-secondary)] transition">
      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
      {label}
      {count !== undefined && <span className="ml-auto text-[11px] opacity-70">{count}</span>}
    </button>
  );
}

/* ============================================
   CUSTOM FIELD GROUP LABELS (fallback)
   ============================================ */
const FIELD_GROUP_LABELS: Record<string, string> = {
  legal: 'Legal / Caso',
  client: 'Cliente',
  reference: 'Referencia',
};

/* ============================================
   MAIN COMPONENT
   ============================================ */
export default function TaskDetailDrawer({
  task, members, teams, lists, userId, userName,
  canUpdate, canDelete, onUpdate, onDelete, onClose,
}: Props) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { activeFields, groups: fieldGroups } = useCustomFieldDefs();

  // --- Feature flags for AI ---
  const aiDecomposeEnabled = useFeatureFlag('ai-decompose-ui');
  const aiWorkloadEnabled = useFeatureFlag('ai-workload-ui');
  const favoritesEnabled = useFeatureFlag('favorites');

  // --- UI state ---
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [tab, setTab] = useState<'comments' | 'activity' | 'details' | null>('comments');
  const [editTitle, setEditTitle] = useState(false);
  const [editDesc, setEditDesc] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  const [descVal, setDescVal] = useState(task.description || '');
  const [newSub, setNewSub] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [showAIDecompose, setShowAIDecompose] = useState(false);
  const [showAIAssignee, setShowAIAssignee] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // --- Real subtask state ---
  const [realSubtasks, setRealSubtasks] = useState<any[]>([]);
  const [realSubtasksLoading, setRealSubtasksLoading] = useState(false);
  const [converting, setConverting] = useState(false);

  // --- Refs ---
  const fileRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // --- Section toggle helper ---
  const toggleSection = useCallback((id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const isSectionCollapsed = (id: string) => collapsedSections.has(id);

  // --- Sync task data when task changes ---
  useEffect(() => {
    setTitleVal(task.title);
    setDescVal(task.description || '');
  }, [task.id, task.title, task.description]);

  // --- Load comments & activity ---
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const loadData = useCallback(async () => {
    try { const r = await getTaskComments(task.id); setComments(r.items); setCommentsHasMore(r.hasMore); } catch (err) { console.error('[TaskDrawer] Failed to load comments:', err); setComments([]); }
    try { const r = await getTaskActivity(task.id); setActivity(r.items); setActivityHasMore(r.hasMore); } catch (err) { console.error('[TaskDrawer] Failed to load activity:', err); setActivity([]); }
  }, [task.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Load real subtasks ---
  const hasRealSubtasks = Array.isArray(task.subtaskIds) && task.subtaskIds.length > 0;
  const hasLegacySubtasks = Array.isArray(task.subtasks) && task.subtasks.length > 0;

  const loadRealSubtasks = useCallback(async () => {
    if (!hasRealSubtasks) { setRealSubtasks([]); return; }
    setRealSubtasksLoading(true);
    try {
      const subs = await getSubtasks(task.id);
      setRealSubtasks(subs);
    } catch (err) {
      console.error('[TaskDrawer] Failed to load real subtasks:', err);
      setRealSubtasks([]);
    } finally {
      setRealSubtasksLoading(false);
    }
  }, [task.id, hasRealSubtasks]);

  useEffect(() => { loadRealSubtasks(); }, [loadRealSubtasks]);

  // --- Convert legacy subtasks to real subtasks ---
  const handleConvertLegacy = async () => {
    if (converting || !canUpdate) return;
    setConverting(true);
    try {
      await convertLegacySubtasks(task.id, task.teamId, userId);
      // Clear legacy subtasks from the task document
      onUpdate(task.id, 'subtasks', []);
      // Reload real subtasks
      await loadRealSubtasks();
      toast?.success?.('Subtasks converted successfully');
    } catch (err) {
      console.error('[TaskDrawer] Legacy subtask conversion failed:', err);
      toast?.error?.('Failed to convert subtasks');
    } finally {
      setConverting(false);
    }
  };

  // --- Computed values ---
  const st = getStatusConfig(task.status);
  const tp = getTypeConfig(task.type || 'task');
  const pr = getPriorityConfig(task.priority);
  const visConf = getVisibilityConfig(task.visibility || 'team');
  const taskTeam = teams.find((tm: any) => tm.id === task.teamId);
  const due = task.dueDate?.toDate?.();
  const start = task.startDate?.toDate?.();
  const { done: doneSub, total: totalSub, pct: progress } = getSubtaskProgress(task);
  const realSubProgress = rollupProgress(realSubtasks);
  const combinedSubtaskCount = totalSub + realSubProgress.total;
  const customFields = task.customFields || {};
  const activeFieldIds = Object.keys(customFields);
  const fieldsByGroup = getFieldsByGroup(activeFields);
  const availableFields = activeFields.filter(f => !activeFieldIds.includes(f.id));

  // --- Title save ---
  const saveTitle = () => {
    if (titleVal.trim() && titleVal !== task.title && canUpdate) {
      onUpdate(task.id, 'title', titleVal.trim(), task.title);
    }
    setEditTitle(false);
  };

  // --- Description save ---
  const saveDesc = () => {
    if (canUpdate) onUpdate(task.id, 'description', descVal, task.description);
    setEditDesc(false);
  };

  // --- Subtask handlers ---
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

  // --- Custom field handlers (with validation) ---
  const setCustomField = (fid: string, val: unknown) => {
    const proposed = { ...customFields, [fid]: val };
    const { sanitized } = validateCustomFieldValues(proposed, activeFields);
    onUpdate(task.id, 'customFields', sanitized);
  };
  const removeCustomField = (fid: string) => {
    const u = { ...customFields };
    delete u[fid];
    onUpdate(task.id, 'customFields', u);
  };

  // --- File upload ---
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !canUpdate) return;
    for (const file of Array.from(files)) {
      setUploading(true);
      setUploadPct(0);
      try {
        const result = await uploadFile(file, 'task-uploads', setUploadPct);
        const att = { id: Date.now().toString(), ...result, uploadedBy: userId, uploadedAt: new Date() };
        onUpdate(task.id, 'attachments', [...(task.attachments || []), att]);
      } catch (err: any) {
        toast.error('Error al subir archivo', err.message || 'Ocurrio un error al subir el archivo.');
      }
      setUploading(false);
    }
  };
  const removeAttachment = (attId: string) => {
    if (!canUpdate) return;
    onUpdate(task.id, 'attachments', (task.attachments || []).filter((a: any) => a.id !== attId));
  };

  // --- Comment @mention handling ---
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
    await addTaskComment(task.id, {
      text: newComment.trim(),
      authorId: userId,
      authorName: userName,
      mentions: mentionIds,
    });
    if (mentionIds.length > 0) {
      notifyMany(mentionIds, {
        type: 'task_mentioned',
        title: t('chat.mentionedYou', { name: userName, channel: task.title }),
        message: newComment.trim().slice(0, 80),
        entityType: 'task',
        entityId: task.id,
        entityUrl: '/app/tasks',
        actorId: userId,
        actorName: userName,
      }).catch(err => console.error('[TaskDrawer] Notification failed:', err));
    }
    setNewComment('');
    setMentionIds([]);
    const r = await getTaskComments(task.id); setComments(r.items); setCommentsHasMore(r.hasMore);
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // --- File icon helper ---
  const getFileIcon = (type: string) => {
    if (isImageType(type)) return ImageIcon;
    if (isVideoType(type)) return Video;
    if (isAudioType(type)) return Music;
    return FileText;
  };

  /* ============================================
     SHARED CONTENT (used in both modes)
     ============================================ */
  const content = (
    <div className="flex flex-col h-full overflow-hidden min-w-0 max-w-full">
      {/* ---- Header bar ---- */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-[var(--border)]/40 bg-[var(--bg-tertiary)]/30">
        <div className="flex items-center gap-2 min-w-0">
          <tp.Icon className="h-4 w-4 shrink-0" style={{ color: tp.color }} />
          <span className="text-sm font-semibold text-[var(--text-muted)] uppercase">
            {t(`taskType.${tp.id}`)}
          </span>
          {visConf && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1 font-medium shrink-0"
              style={{ backgroundColor: `${visConf.color}10`, color: visConf.color }}
            >
              <visConf.Icon className="h-2.5 w-2.5" />
              {t(`visibility.${visConf.id}`)}
            </span>
          )}
          {taskTeam && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
              style={{ backgroundColor: `${taskTeam.color}15`, color: taskTeam.color }}
            >
              {taskTeam.icon} {taskTeam.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition"
            title={expanded ? 'Minimizar' : 'Pantalla completa'}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {(canDelete || task.createdBy === userId) && (
            <button
              onClick={() => onDelete(task)}
              className="p-2 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-6 py-5 space-y-5 min-w-0">

          {/* ===== 1. TITLE ===== */}
          {editTitle && canUpdate ? (
            <div className="flex gap-2">
              <input
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                className="input-dark flex-1 text-[20px] font-bold"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') { setEditTitle(false); setTitleVal(task.title); }
                }}
              />
              <button onClick={saveTitle} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => { setEditTitle(false); setTitleVal(task.title); }} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <h2
                className={`text-[20px] font-bold text-[var(--text-primary)] ${canUpdate ? 'cursor-pointer hover:text-[var(--accent)]' : ''} transition`}
                onClick={() => canUpdate && setEditTitle(true)}
              >
                {task.title}
              </h2>
              {favoritesEnabled && (
                <FavoriteButton entityType="task" entityId={task.id} entityTitle={task.title} userId={userId} />
              )}
            </div>
          )}

          {/* ===== 2. STATUS & PRIORITY ROW ===== */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.status')}
              </label>
              <select
                value={task.status}
                onChange={e => canUpdate && onUpdate(task.id, 'status', e.target.value, task.status)}
                disabled={!canUpdate}
                className="w-full h-9 px-3 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ backgroundColor: `${st.color}10`, borderColor: `${st.color}25`, color: st.color }}
              >
                {STATUSES.map(s => (
                  <option key={s.id} value={s.id}>{t(`status.${s.id}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.priority')}
              </label>
              <div className="flex gap-1.5">
                {PRIORITIES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => canUpdate && onUpdate(task.id, 'priority', p.id, task.priority)}
                    title={t(`priority.${p.id}`)}
                    disabled={!canUpdate}
                    className={`h-8 px-3 rounded-full flex items-center justify-center gap-1.5 text-sm transition ${
                      task.priority === p.id
                        ? 'ring-2 ring-white/20 bg-white/5 scale-105'
                        : 'opacity-40 hover:opacity-70'
                    }`}
                  >
                    {p.icon}
                    {task.priority === p.id && <span className="text-[12px] font-medium">{t(`priority.${p.id}`)}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ===== 3. QUICK INFO GRID ===== */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.visibility')}
              </label>
              <select
                value={task.visibility || 'team'}
                onChange={e => canUpdate && onUpdate(task.id, 'visibility', e.target.value, task.visibility)}
                disabled={!canUpdate}
                className="select-dark w-full h-9 text-sm"
              >
                {VISIBILITY.map(v => (
                  <option key={v.id} value={v.id}>{t(`visibility.${v.id}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.department')}
              </label>
              <select
                value={task.teamId || ''}
                onChange={e => canUpdate && onUpdate(task.id, 'teamId', e.target.value, task.teamId)}
                disabled={!canUpdate}
                className="select-dark w-full h-9 text-sm"
              >
                <option value="">{t('common.general')}</option>
                {teams.map((tm: any) => (
                  <option key={tm.id} value={tm.id}>{tm.icon} {tm.name}</option>
                ))}
              </select>
            </div>
            {/* List selector — move task between lists */}
            {lists && lists.length > 0 && (
              <div>
                <label className="block text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] mb-1.5 font-semibold">
                  {t('spaces.lists')}
                </label>
                <select
                  value={task.listId || ''}
                  onChange={e => canUpdate && onUpdate(task.id, 'listId', e.target.value || null, task.listId)}
                  disabled={!canUpdate}
                  className="select-dark w-full h-9 text-sm"
                >
                  <option value="">{t('spaces.unsorted')}</option>
                  {lists.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.startDate')}
              </label>
              <input
                type="date"
                value={start ? start.toISOString().split('T')[0] : ''}
                disabled={!canUpdate}
                onChange={e => canUpdate && onUpdate(task.id, 'startDate', e.target.value ? new Date(e.target.value) : null)}
                className="input-dark h-9 text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] mb-1.5 font-semibold">
                {t('taskCreate.dueDate')}
              </label>
              <input
                type="date"
                value={due ? due.toISOString().split('T')[0] : ''}
                disabled={!canUpdate}
                onChange={e => canUpdate && onUpdate(task.id, 'dueDate', e.target.value ? new Date(e.target.value) : null)}
                className="input-dark h-9 text-sm w-full"
              />
            </div>
          </div>

          <div className="h-px bg-[var(--border-subtle)] mx-0" />

          {/* ===== 4. DESCRIPTION (collapsible) ===== */}
          <div>
            <SectionHeader
              id="description"
              label={t('taskCreate.description')}
              collapsed={isSectionCollapsed('description')}
              onToggle={() => toggleSection('description')}
            />
            <AnimatePresence initial={false}>
              {!isSectionCollapsed('description') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {editDesc && canUpdate ? (
                    <div>
                      <textarea
                        value={descVal}
                        onChange={e => setDescVal(e.target.value)}
                        rows={5}
                        autoFocus
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] text-[14px] leading-relaxed text-[var(--text-secondary)] resize-y min-h-[100px] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={saveDesc}
                          className="px-3 h-7 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-[13px]"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          onClick={() => { setEditDesc(false); setDescVal(task.description || ''); }}
                          className="px-3 h-7 rounded-lg bg-[var(--bg-tertiary)] text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-all duration-200"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => canUpdate && setEditDesc(true)}
                      className={`min-h-[50px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] ${canUpdate ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''} transition-all duration-200`}
                    >
                      {task.description ? (
                        <p className="text-[14px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">{task.description}</p>
                      ) : (
                        <p className="text-[14px] leading-relaxed text-[var(--text-muted)]">
                          {canUpdate ? t('taskCreate.descPlaceholder') : t('common.noResults')}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ===== 5. ASSIGNEES (collapsible) ===== */}
          <div>
            <SectionHeader
              id="assignees"
              label={t('taskCreate.assignees')}
              count={(task.assignees || []).length}
              collapsed={isSectionCollapsed('assignees')}
              onToggle={() => toggleSection('assignees')}
            />
            <AnimatePresence initial={false}>
              {!isSectionCollapsed('assignees') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1.5 flex-wrap">
                    {members.map((m: any) => {
                      const assigned = task.assignees?.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          disabled={!canUpdate}
                          onClick={() => {
                            const n = assigned
                              ? task.assignees.filter((x: string) => x !== m.id)
                              : [...(task.assignees || []), m.id];
                            onUpdate(task.id, 'assignees', n, task.assignees);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                            assigned
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/20'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[8px] font-bold">
                            {m.displayName?.[0]?.toUpperCase()}
                          </div>
                          {m.displayName?.split(' ')[0]}
                          {assigned && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                    {/* AI Suggest Assignees button */}
                    {aiWorkloadEnabled && canUpdate && (
                      <div className="relative">
                        <button
                          onClick={() => setShowAIAssignee(!showAIAssignee)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
                          title="AI Suggest Assignees"
                          data-testid="ai-assignee-btn"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Suggest
                        </button>
                        {showAIAssignee && (
                          <AIAssigneeSuggestions
                            taskId={task.id}
                            taskTitle={task.title}
                            taskDescription={task.description}
                            onSelectAssignee={(uid) => {
                              const current = task.assignees || [];
                              if (!current.includes(uid)) {
                                onUpdate(task.id, 'assignees', [...current, uid], current);
                              }
                            }}
                            onClose={() => setShowAIAssignee(false)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-px bg-[var(--border-subtle)] mx-0" />

          {/* ===== 6. SUBTASKS (collapsible) ===== */}
          <div>
            <SectionHeader
              id="subtasks"
              label={t('taskCreate.subtasks')}
              count={combinedSubtaskCount > 0 ? combinedSubtaskCount : undefined}
              collapsed={isSectionCollapsed('subtasks')}
              onToggle={() => toggleSection('subtasks')}
            />
            <AnimatePresence initial={false}>
              {!isSectionCollapsed('subtasks') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* --- Real subtasks (first-class task documents) --- */}
                  {hasRealSubtasks && (
                    <>
                      {realSubtasksLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
                        </div>
                      ) : (
                        <SubtaskList
                          parentTaskId={task.id}
                          subtasks={realSubtasks}
                          members={members}
                          teamId={task.teamId}
                          listId={task.listId}
                          userId={userId}
                          canUpdate={canUpdate}
                          onMutate={loadRealSubtasks}
                        />
                      )}
                    </>
                  )}

                  {/* --- Legacy embedded subtasks (fallback for unmigrated tasks) --- */}
                  {hasLegacySubtasks && (
                    <div className={hasRealSubtasks ? 'mt-4 pt-4 border-t border-[var(--border-subtle)]' : ''}>
                      {hasRealSubtasks && (
                        <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2 block">
                          Legacy subtasks
                        </span>
                      )}

                      {totalSub > 0 && !hasRealSubtasks && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] text-[var(--text-muted)]">
                              {doneSub}/{totalSub} · {progress}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {(task.subtasks || []).map((s: any, i: number) => (
                        <div key={s.id} className="flex items-center gap-2 py-2.5 px-3.5 rounded-xl hover:bg-[var(--bg-elevated)] group">
                          <button
                            onClick={() => toggleSub(i)}
                            disabled={!canUpdate}
                            className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition shrink-0 ${
                              s.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--border)]'
                            }`}
                          >
                            {s.done && <Check className="h-2.5 w-2.5" />}
                          </button>
                          <span className={`text-[14px] flex-1 ${s.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
                            {s.title}
                          </span>
                          {canUpdate && (
                            <button
                              onClick={() => removeSub(i)}
                              className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Convert legacy subtasks to real subtasks */}
                      {canUpdate && (
                        <button
                          onClick={handleConvertLegacy}
                          disabled={converting}
                          className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl text-[12px] text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition w-full justify-center disabled:opacity-50"
                        >
                          {converting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          )}
                          {converting ? 'Converting...' : 'Convert to real subtasks'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* --- Add subtask input (legacy inline add, shown when no real subtasks yet) --- */}
                  {canUpdate && !hasRealSubtasks && (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={newSub}
                        onChange={e => setNewSub(e.target.value)}
                        placeholder={t('taskCreate.addSubtask')}
                        className="input-dark h-10 rounded-xl text-sm flex-1"
                        onKeyDown={e => e.key === 'Enter' && addSub()}
                      />
                      <button
                        onClick={addSub}
                        className="px-3 h-10 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      {aiDecomposeEnabled && (
                        <button
                          onClick={() => setShowAIDecompose(!showAIDecompose)}
                          className="px-3 h-10 rounded-xl bg-[var(--accent)]/10 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/20 transition flex items-center gap-1.5"
                          title="Decompose with AI"
                          data-testid="ai-decompose-btn"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* AI Decompose Panel */}
                  {showAIDecompose && aiDecomposeEnabled && (
                    <AIDecomposePanel
                      taskId={task.id}
                      taskTitle={task.title}
                      taskDescription={task.description}
                      onAddSubtasks={(subtasks) => {
                        const existing = task.subtasks || [];
                        onUpdate(task.id, 'subtasks', [...existing, ...subtasks]);
                      }}
                      onClose={() => setShowAIDecompose(false)}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ===== 7. CUSTOM FIELDS (collapsible) ===== */}
          <div>
            <SectionHeader
              id="customFields"
              label={t('taskCreate.customFields')}
              count={activeFieldIds.length > 0 ? activeFieldIds.length : undefined}
              collapsed={isSectionCollapsed('customFields')}
              onToggle={() => toggleSection('customFields')}
            />
            <AnimatePresence initial={false}>
              {!isSectionCollapsed('customFields') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* Add field button */}
                  {canUpdate && availableFields.length > 0 && (
                    <div className="mb-3">
                      <button
                        onClick={() => setShowFieldPicker(!showFieldPicker)}
                        className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> {t('common.create')}
                      </button>
                    </div>
                  )}

                  {/* Field picker */}
                  <AnimatePresence>
                    {showFieldPicker && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl bg-[var(--bg-elevated)] shadow-card">
                          {availableFields.map(f => (
                            <button
                              key={f.id}
                              onClick={() => {
                                setCustomField(f.id, f.type === 'boolean' ? false : f.defaultValue ?? '');
                                setShowFieldPicker(false);
                              }}
                              className="text-sm px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200"
                            >
                              {lang === 'es' ? f.nameEs : f.name}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Grouped fields */}
                  {fieldGroups.map(group => {
                    const groupFields = activeFieldIds
                      .map(fid => activeFields.find(f => f.id === fid))
                      .filter((f): f is NonNullable<typeof f> => !!f && f.group === group.id);
                    if (groupFields.length === 0) return null;
                    return (
                      <div key={group.id} className="mb-3 rounded-xl p-4 bg-[var(--bg-tertiary)]/50">
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]/50 font-semibold mb-2">
                          {lang === 'es' ? group.nameEs : group.name}
                        </div>
                        {groupFields.map(field => (
                          <div key={field.id} className="flex items-center gap-2 mb-2">
                            <label className="text-[13px] text-[var(--text-muted)] w-32 shrink-0 truncate">
                              {lang === 'es' ? field.nameEs : field.name}
                            </label>
                            <div className="flex-1">
                              <CustomFieldRenderer
                                field={field}
                                value={customFields[field.id]}
                                onChange={v => setCustomField(field.id, v)}
                                readOnly={!canUpdate}
                                members={members}
                              />
                            </div>
                            {field.helpText && (
                              <span className="text-[11px] text-[var(--text-muted)]" title={lang === 'es' ? field.helpTextEs : field.helpText}>?</span>
                            )}
                            {canUpdate && (
                              <button
                                onClick={() => removeCustomField(field.id)}
                                className="text-[var(--text-muted)] hover:text-red-400 p-1 transition"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Ungrouped fields (safety net) */}
                  {activeFieldIds
                    .map(fid => activeFields.find(f => f.id === fid))
                    .filter((f): f is NonNullable<typeof f> => !!f && !fieldGroups.some(g => g.id === f.group))
                    .map(field => (
                      <div key={field.id} className="flex items-center gap-2 mb-2">
                        <label className="text-[13px] text-[var(--text-muted)] w-32 shrink-0 truncate">
                          {lang === 'es' ? field.nameEs : field.name}
                        </label>
                        <div className="flex-1">
                          <CustomFieldRenderer
                            field={field}
                            value={customFields[field.id]}
                            onChange={v => setCustomField(field.id, v)}
                            readOnly={!canUpdate}
                            members={members}
                          />
                        </div>
                        {canUpdate && (
                          <button
                            onClick={() => removeCustomField(field.id)}
                            className="text-[var(--text-muted)] hover:text-red-400 p-1 transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ===== 8. TAGS (collapsible) ===== */}
          <div>
            <SectionHeader
              id="tags"
              label={t('taskCreate.tags')}
              count={(task.tags || []).length > 0 ? (task.tags || []).length : undefined}
              collapsed={isSectionCollapsed('tags')}
              onToggle={() => toggleSection('tags')}
            />
            <AnimatePresence initial={false}>
              {!isSectionCollapsed('tags') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1.5 flex-wrap">
                    {(task.tags || []).map((tag: string) => (
                      <span
                        key={tag}
                        className="text-[13px] px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] flex items-center gap-1"
                      >
                        <Hash className="h-3 w-3" />
                        {tag}
                        {canUpdate && (
                          <button
                            onClick={() => onUpdate(task.id, 'tags', task.tags.filter((tg: string) => tg !== tag))}
                            className="text-[var(--text-muted)] hover:text-red-400 transition"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {(task.tags || []).length === 0 && (
                      <span className="text-sm text-[var(--text-muted)]">{t('common.noResults')}</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-px bg-[var(--border-subtle)] mx-0" />

          {/* ===== 9. ATTACHMENTS (collapsible) ===== */}
          <div>
            <SectionHeader
              id="attachments"
              label={t('taskDetail.attachments')}
              count={(task.attachments || []).length > 0 ? (task.attachments || []).length : undefined}
              collapsed={isSectionCollapsed('attachments')}
              onToggle={() => toggleSection('attachments')}
            />
            <AnimatePresence initial={false}>
              {!isSectionCollapsed('attachments') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {canUpdate && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1 mb-2"
                    >
                      <Paperclip className="h-3 w-3" /> {t('taskDetail.addAttachment')}
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_FILES}
                    multiple
                    hidden
                    onChange={e => handleFileUpload(e.target.files)}
                  />

                  {uploading && (
                    <div className="mb-3 rounded-xl p-4 bg-[var(--bg-elevated)] shadow-card">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1.5">
                        <Paperclip className="h-3 w-3 animate-pulse" /> {t('common.loading')} {uploadPct}%
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent)] transition-all"
                          style={{ width: `${uploadPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Attachment list */}
                  {(() => {
                    const allAtts = task.attachments || [];
                    if (allAtts.length === 0 && !uploading) {
                      return <p className="text-sm text-[var(--text-muted)] text-center py-2">{t('common.noResults')}</p>;
                    }
                    const mediaAtts = allAtts.filter((a: any) => isImageType(a.type) || isVideoType(a.type));
                    const otherAtts = allAtts.filter((a: any) => !isImageType(a.type) && !isVideoType(a.type));

                    return (
                      <div className="space-y-3">
                        {/* Media grid — compact thumbnails, 2 per row */}
                        {mediaAtts.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {mediaAtts.map((att: any) => {
                              const isImg = isImageType(att.type);
                              const h = isImg ? 110 : 130;
                              return (
                                <div key={att.id} className="group relative rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black" style={{ height: `${h}px` }}>
                                  {isImg ? (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                      <img src={att.url} alt={att.name} style={{ width: '100%', height: `${h}px`, objectFit: 'cover', display: 'block' }} />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                        <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </a>
                                  ) : (
                                    <video src={att.url} controls style={{ width: '100%', height: `${h}px`, objectFit: 'contain', display: 'block' }} />
                                  )}
                                  {canUpdate && (
                                    <button
                                      onClick={() => removeAttachment(att.id)}
                                      className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Other files — compact list */}
                        {otherAtts.map((att: any) => {
                          const FileIcon = getFileIcon(att.type);
                          const isAud = isAudioType(att.type);
                          return (
                            <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] group">
                              <FileIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                              <span className="text-[12px] font-medium text-[var(--text-secondary)] truncate flex-1">{att.name}</span>
                              {isAud && <audio src={att.url} controls className="h-7 max-w-[140px] shrink-0" />}
                              <span className="text-[11px] text-[var(--text-muted)] shrink-0">{formatFileSize(att.size)}</span>
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition shrink-0">
                                <Download className="h-3 w-3" />
                              </a>
                              {canUpdate && (
                                <button onClick={() => removeAttachment(att.id)} className="p-1 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ===== 10. DEPENDENCIES (collapsible) ===== */}
          <div>
            <SectionHeader
              id="dependencies"
              label={t('taskDetail.dependencies')}
              count={(task.dependencies || []).length > 0 ? (task.dependencies || []).length : undefined}
              collapsed={isSectionCollapsed('dependencies')}
              onToggle={() => toggleSection('dependencies')}
            />
            <AnimatePresence initial={false}>
              {!isSectionCollapsed('dependencies') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {(task.dependencies || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {(task.dependencies || []).map((depId: string) => (
                        <div key={depId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)]">
                          <GitBranch className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          <span className="text-sm text-[var(--text-secondary)] truncate">{depId}</span>
                        </div>
                      ))}
                      <p className="text-[11px] text-[var(--text-muted)]/50 mt-1">
                        This task is blocked until the above tasks are completed.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)] text-center py-2">{t('common.noResults')}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ===== RECURRENCE ===== */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)]">
          {task.recurrenceTemplateId && (
            <div className="flex items-center gap-2 text-[12px] text-[var(--accent)] mb-2">
              <Repeat className="h-3 w-3" />
              {t('recurrence.partOfSeries')}
            </div>
          )}
          {canUpdate ? (
            <RecurrencePicker
              value={task.recurrence}
              onChange={(cfg) => onUpdate(task.id, 'recurrence', cfg)}
            />
          ) : task.recurrence ? (
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
              <Repeat className="h-3 w-3 text-[var(--accent)]" />
              {getRecurrenceDescription(task.recurrence, t, 'es')}
            </div>
          ) : null}
        </div>

        {/* ===== GITHUB LINKS ===== */}
        <FeatureGate flag="github-pr-linking">
          <div className="px-6 py-3 border-t border-[var(--border-subtle)]">
            <TaskGithubLinks taskId={task.id} canEdit={canUpdate} />
          </div>
        </FeatureGate>

        {/* ===== RELATED ITEMS ===== */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)]">
          <EntityRelations
            entityType="task"
            entityId={task.id}
            entityName={task.title || 'Untitled'}
            canEdit={canUpdate}
          />
        </div>

        {/* ===== LINKED GOALS ===== */}
        <LinkedGoalsSection taskId={task.id} lang={lang} />

        {/* ===== LINKED DOCS ===== */}
        <LinkedDocsSection taskId={task.id} lang={lang} />

        {/* ===== BOTTOM TABS ===== */}
        <div className="sticky bottom-0 bg-[var(--bg-base)] overflow-hidden min-w-0">
          <div className="flex px-6 border-b border-[var(--border-subtle)]">
            {([
              { key: 'comments' as const, label: `${t('taskDetail.comments')} (${comments.length})`, icon: MessageSquare },
              { key: 'activity' as const, label: t('taskDetail.activity'), icon: Activity },
              { key: 'details' as const, label: t('taskDetail.details'), icon: Eye },
            ]).map(tb => (
              <button
                key={tb.key}
                onClick={() => setTab(tab === tb.key ? null : tb.key)}
                className={`flex items-center gap-2 h-10 px-4 text-[13px] font-medium border-b-2 transition ${
                  tab === tb.key
                    ? 'text-[var(--accent)] border-[var(--accent)]'
                    : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
                }`}
              >
                <tb.icon className="h-4 w-4" />
                {tb.label}
              </button>
            ))}
          </div>

          <AnimatePresence initial={false}>
          {tab !== null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
          <div className="px-6 py-5 overflow-hidden min-w-0">
            {/* --- Comments Tab --- */}
            {tab === 'comments' && (
              <div className="overflow-hidden min-w-0">
                <div className="space-y-4 mb-4 max-h-64 overflow-y-auto overflow-x-hidden">
                  {comments.length === 0 && (
                    <p className="text-sm text-[var(--text-muted)] text-center py-4">
                      {t('taskDetail.noComments')}
                    </p>
                  )}
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-[12px] font-bold text-[var(--accent)] shrink-0">
                        {c.authorName?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{c.authorName}</span>
                          <span className="text-[12px] text-[var(--text-muted)]">
                            {c.createdAt?.toDate?.()?.toLocaleString?.('es-MX') || ''}
                          </span>
                        </div>
                        <p className="text-[14px] leading-relaxed text-[var(--text-secondary)] mt-0.5 break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                          {c.text?.split(/(@\w+)/g).map((part: string, i: number) =>
                            part.startsWith('@')
                              ? <span key={i} className="text-[var(--accent)] font-medium">{part}</span>
                              : part
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                  {commentsHasMore && (
                    <p className="text-[12px] text-[var(--text-muted)] text-center py-2">Mostrando los primeros 200 comentarios</p>
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Comment input with @mentions */}
                <div className="relative">
                  <AnimatePresence>
                    {mentionOpen && filteredMentionMembers.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-elevated)] rounded-xl shadow-dropdown max-h-40 overflow-y-auto z-10"
                      >
                        {filteredMentionMembers.map(m => (
                          <button
                            key={m.id}
                            onClick={() => insertMention(m)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] text-left transition"
                          >
                            <div className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[9px] font-bold text-[var(--accent)]">
                              {m.displayName?.[0]?.toUpperCase()}
                            </div>
                            <span className="text-sm text-[var(--text-secondary)]">{m.displayName}</span>
                            <span className="text-[12px] text-[var(--text-muted)] ml-auto">{m.title || m.role}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex gap-2 items-center">
                    <input
                      ref={commentRef}
                      value={newComment}
                      onChange={e => handleCommentChange(e.target.value)}
                      placeholder={t('taskDetail.addComment')}
                      className="flex-1 min-h-[48px] rounded-xl border border-[var(--border-subtle)] focus:border-[var(--accent)]/30 bg-[var(--bg-elevated)] px-4 py-3 text-[14px] text-[var(--text-secondary)] focus:outline-none transition"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !mentionOpen) postComment();
                        if (e.key === 'Escape') setMentionOpen(false);
                      }}
                    />
                    <button
                      onClick={postComment}
                      className="h-8 w-8 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition flex items-center justify-center shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- Activity Tab --- */}
            {tab === 'activity' && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activity.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)] text-center py-4">
                    {t('taskDetail.noActivity')}
                  </p>
                )}
                {activity.map(a => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[var(--accent)] font-medium">{a.actorName}</span>{' '}
                      <span className="text-[var(--text-muted)]">{a.action}</span>
                      {a.field && <span className="text-[var(--text-muted)]"> {a.field}</span>}
                      {a.from && <span className="text-red-400/60 line-through ml-1">{a.from}</span>}
                      {a.to && (
                        <>
                          {a.from && <span className="text-[var(--text-muted)] mx-1">-&gt;</span>}
                          <span className="text-emerald-400">{a.to}</span>
                        </>
                      )}
                      {(a.automationId || a.automationName) && (
                        <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400">
                          <Sparkles className="h-2.5 w-2.5" />
                          {a.automationName || 'Automation'}
                        </span>
                      )}
                      <span className="text-[var(--text-muted)]/40 ml-2 text-[12px]">
                        {a.createdAt?.toDate?.()?.toLocaleString?.('es-MX') || ''}
                      </span>
                    </div>
                  </div>
                ))}
                {activityHasMore && (
                  <p className="text-[12px] text-[var(--text-muted)] text-center py-2">Mostrando las primeras 500 entradas</p>
                )}
              </div>
            )}

            {/* --- Details Tab --- */}
            {tab === 'details' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <CheckSquare className="h-3 w-3" />{t('taskCreate.type')}
                  </span>
                  <span className="text-[var(--text-secondary)] flex items-center gap-1">
                    <tp.Icon className="h-3 w-3" style={{ color: tp.color }} />
                    {t(`taskType.${tp.id}`)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />{t('taskCreate.visibility')}
                  </span>
                  <span className="text-[var(--text-secondary)] flex items-center gap-1">
                    {visConf && (
                      <>
                        <visConf.Icon className="h-3 w-3" style={{ color: visConf.color }} />
                        {t(`visibility.${visConf.id}`)}
                      </>
                    )}
                  </span>
                </div>
                {taskTeam && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                      <User className="h-3 w-3" />{t('taskCreate.department')}
                    </span>
                    <span className="text-[var(--text-secondary)]">{taskTeam.icon} {taskTeam.name}</span>
                  </div>
                )}
                {task.timeEstimate != null && task.timeEstimate > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />{t('taskCreate.timeEstimate')}
                    </span>
                    <span className="text-[var(--text-secondary)]">{task.timeEstimate}m</span>
                  </div>
                )}
                {task.points != null && task.points > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                      <Activity className="h-3 w-3" />{t('taskCreate.points')}
                    </span>
                    <span className="text-[var(--text-secondary)]">{task.points}</span>
                  </div>
                )}
                <div className="h-px bg-[var(--border-subtle)] mx-0" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />{t('taskDetail.created')}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {task.createdAt?.toDate?.()?.toLocaleDateString?.('es-MX') || '\u2014'}
                  </span>
                </div>
                {task.updatedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />{t('taskDetail.updated')}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      {task.updatedAt?.toDate?.()?.toLocaleDateString?.('es-MX') || '\u2014'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <User className="h-3 w-3" />{t('taskDetail.createdBy')}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {members.find(m => m.id === task.createdBy)?.displayName || task.createdBy}
                  </span>
                </div>
              </div>
            )}
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  /* ============================================
     RENDER: Drawer vs Fullscreen
     ============================================ */
  if (expanded) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Full panel */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-3xl h-[90vh] bg-[var(--bg-base)]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden"
          >
            {content}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40"
    >
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      {/* Floating drawer */}
      <motion.div
        initial={{ x: '100%', opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.8 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: '540px', maxWidth: 'calc(85vw - 24px)' }}
        className="fixed top-3 right-3 bottom-3 z-50 bg-[var(--bg-base)] rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
      >
        {content}
      </motion.div>
    </motion.div>
  );
}

// ─── Linked Goals Section ──────────────────────────
function LinkedGoalsSection({ taskId, lang }: { taskId: string; lang: string }) {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    import('@/lib/relations').then(({ getRelationsForEntity }) =>
      getRelationsForEntity(taskId).then(rels => {
        const goalRels = rels.filter((r: any) => r.targetType === 'goal' || r.sourceType === 'goal');
        setGoals(goalRels);
        setLoading(false);
      })
    ).catch(() => setLoading(false));
  }, [taskId]);
  if (loading || goals.length === 0) return null;
  return (
    <div className="px-6 py-3 border-t border-[var(--border-subtle)]">
      <h4 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span>🎯</span> {lang === 'es' ? 'Objetivos Vinculados' : 'Linked Goals'}
      </h4>
      <div className="space-y-1">
        {goals.map((g: any) => (
          <div key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-[12px]">
            <span className="text-[var(--success)] font-medium">{g.targetName || g.sourceName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Linked Docs Section ──────────────────────────
function LinkedDocsSection({ taskId, lang }: { taskId: string; lang: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    import('@/lib/relations').then(({ getRelationsForEntity }) =>
      getRelationsForEntity(taskId).then(rels => {
        const docRels = rels.filter((r: any) => r.targetType === 'doc' || r.sourceType === 'doc');
        setDocs(docRels);
        setLoading(false);
      })
    ).catch(() => setLoading(false));
  }, [taskId]);
  if (loading || docs.length === 0) return null;
  return (
    <div className="px-6 py-3 border-t border-[var(--border-subtle)]">
      <h4 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" /> {lang === 'es' ? 'Documentos Vinculados' : 'Linked Docs'}
      </h4>
      <div className="space-y-1">
        {docs.map((d: any) => (
          <a key={d.id} href={`/app/docs?doc=${d.targetId || d.sourceId}`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-[12px] hover:bg-[var(--bg-hover)] transition">
            <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="text-[var(--text-primary)]">{d.targetName || d.sourceName}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
