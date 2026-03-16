'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useCallback } from 'react';
import { getAutomations, createAutomation, updateAutomation, deleteAutomation, logAction, getAutomationLogs } from '@/lib/db';
import { useFeatureFlag } from '@/lib/feature-flags';
import {
  Plus, Trash2, Zap, ArrowRight, Power, PowerOff, ChevronDown, ChevronRight,
  Play, Pause, Filter, Clock, CheckSquare, Bell, Mail, MessageSquare, Bot,
  Users, Tag, Calendar, AlertTriangle, Edit2, Copy, Search, X, Settings, History,
  Archive, Globe, ListPlus, GitBranch, ClipboardList, Sparkles,
} from 'lucide-react';
import AutomationTemplatePicker from '@/components/automations/automation-template-picker';
import AISuggestionsPanel from '@/components/automations/ai-suggestions-panel';
import type { AutomationTemplate } from '@/lib/automation-templates';

// === TRIGGER CONFIGS ===
const TRIGGERS = [
  { id: 'task_created', label: 'Task Created', icon: Plus, color: '#22C55E', desc: 'When a new task is created' },
  { id: 'task_status_changed', label: 'Status Changed', icon: CheckSquare, color: '#3B82F6', desc: 'When a task status changes' },
  { id: 'task_assigned', label: 'Task Assigned', icon: Users, color: '#A855F7', desc: 'When someone is assigned to a task' },
  { id: 'task_priority_changed', label: 'Priority Changed', icon: Tag, color: '#F59E0B', desc: 'When a task priority changes' },
  { id: 'task_due_date_changed', label: 'Due Date Changed', icon: Calendar, color: '#06B6D4', desc: 'When a task due date is set or changed' },
  { id: 'task_custom_field_changed', label: 'Custom Field Changed', icon: Settings, color: '#8B5CF6', desc: 'When a custom field value changes' },
  { id: 'task_due_approaching', label: 'Due Approaching', icon: Clock, color: '#64748B', desc: 'When a task due date is approaching', comingSoon: true },
  { id: 'task_overdue', label: 'Task Overdue', icon: AlertTriangle, color: '#EF4444', desc: 'When a task passes its due date', comingSoon: true },
];

// === CONDITION FIELDS ===
const CONDITION_FIELDS = [
  { id: 'status', label: 'Status', options: ['todo', 'in_progress', 'in_review', 'done', 'blocked'] },
  { id: 'priority', label: 'Priority', options: ['urgent', 'high', 'medium', 'low'] },
  { id: 'type', label: 'Type', options: ['task', 'bug', 'feature', 'milestone', 'epic'] },
  { id: 'visibility', label: 'Visibility', options: ['team', 'public', 'private'] },
  { id: 'assignee_count', label: 'Has Assignees', options: ['yes', 'no'] },
  { id: 'has_due_date', label: 'Has Due Date', options: ['yes', 'no'] },
];

const CONDITION_OPS = [
  { id: 'equals', label: 'equals' },
  { id: 'not_equals', label: 'does not equal' },
  { id: 'contains', label: 'contains' },
  { id: 'not_contains', label: 'does not contain' },
  { id: 'starts_with', label: 'starts with' },
  { id: 'ends_with', label: 'ends with' },
  { id: 'greater_than', label: 'is greater than' },
  { id: 'less_than', label: 'is less than' },
  { id: 'greater_than_or_equal', label: 'is greater or equal' },
  { id: 'less_than_or_equal', label: 'is less or equal' },
  { id: 'is_empty', label: 'is empty' },
  { id: 'is_not_empty', label: 'is not empty' },
];

// === ACTION CONFIGS ===
const ACTIONS = [
  { id: 'change_status', label: 'Change Status', icon: CheckSquare, color: '#3B82F6', desc: 'Update task status', configFields: [{ key: 'toStatus', label: 'New Status', options: ['todo', 'in_progress', 'in_review', 'done', 'blocked'] }] },
  { id: 'set_priority', label: 'Set Priority', icon: Tag, color: '#F59E0B', desc: 'Update task priority', configFields: [{ key: 'toPriority', label: 'New Priority', options: ['urgent', 'high', 'medium', 'low'] }] },
  { id: 'assign_user', label: 'Assign User', icon: Users, color: '#A855F7', desc: 'Assign a team member', configFields: [{ key: 'assigneeId', label: 'User', type: 'member' }] },
  { id: 'add_tag', label: 'Add Tag', icon: Tag, color: '#22C55E', desc: 'Add a tag to the task', configFields: [{ key: 'tagName', label: 'Tag', type: 'text' }] },
  { id: 'remove_tag', label: 'Remove Tag', icon: X, color: '#EF4444', desc: 'Remove a tag from the task', configFields: [{ key: 'tagName', label: 'Tag', type: 'text' }] },
  { id: 'post_comment', label: 'Post Comment', icon: MessageSquare, color: '#06B6D4', desc: 'Auto-comment on the task', configFields: [{ key: 'commentText', label: 'Comment', type: 'text' }] },
  { id: 'send_notification', label: 'Send Notification', icon: Bell, color: '#EC4899', desc: 'Notify team members', configFields: [{ key: 'message', label: 'Message', type: 'text' }] },
  { id: 'call_webhook', label: 'Call Webhook', icon: Globe, color: '#8B5CF6', desc: 'Send data to an external URL', configFields: [{ key: 'webhookUrl', label: 'Webhook URL', type: 'text' }, { key: 'method', label: 'HTTP Method', options: ['POST', 'PUT', 'PATCH'] }] },
  { id: 'create_subtask', label: 'Create Subtask', icon: ListPlus, color: '#06B6D4', desc: 'Add a subtask to the task', configFields: [{ key: 'subtaskTitle', label: 'Subtask Title', type: 'text' }] },
  { id: 'archive_task', label: 'Archive Task', icon: Archive, color: '#64748B', desc: 'Archive the task', configFields: [] },
  { id: 'duplicate_task', label: 'Duplicate Task', icon: Copy, color: '#F59E0B', desc: 'Create a copy of the task', configFields: [] },
  { id: 'move_to_list', label: 'Move to List', icon: ArrowRight, color: '#22C55E', desc: 'Move task to a different list', configFields: [{ key: 'listId', label: 'List ID', type: 'text' }] },
];

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface Action {
  id: string;
  type: string;
  config: Record<string, string>;
}

interface BranchBlock {
  id: string;
  conditions: { field: string; operator: string; value: string }[];
  thenActions: Action[];
  elseActions: Action[];
}

interface AutoRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerConfig: Record<string, string>;
  conditions: Condition[];
  actions: Action[];
  branches?: BranchBlock[];
  enabled: boolean;
  teamId: string;
  runCount: number;
  errorCount?: number;
  lastRunAt: any;
  createdAt: any;
}

interface LogEntry {
  id: string;
  status: string;
  actionsExecuted?: { actionType: string; status: string; error?: string }[];
  duration?: number;
  triggerData?: { taskId: string; taskTitle: string };
  actorId?: string;
  error?: string;
  createdAt?: any;
}

// === MAIN ===
export default function AutomationsPage() {
  const { user, me, activeTeamId, teams, can } = useAuth();
  const { t } = useI18n();
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'failure' | 'skipped'>('all');
  const [search, setSearch] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'active' | 'inactive'>('all');

  const canManage = can('automation', 'create');
  const branchingEnabled = useFeatureFlag('automation-branching');
  const templatesEnabled = useFeatureFlag('automation-templates');
  const aiAutomationEnabled = useFeatureFlag('ai-automation-ui');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  const load = useCallback(async () => {
    const { items: r, hasMore: more } = await getAutomations(activeTeamId);
    setRules(r as AutoRule[]);
    setHasMore(more);
    setLoading(false);
  }, [activeTeamId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const toggleEnabled = async (rule: AutoRule) => {
    await updateAutomation(rule.id, { enabled: !rule.enabled });
    load();
  };

  const handleDelete = async (rule: AutoRule) => {
    if (!confirm(t('automations.deleteConfirm', { name: rule.name }))) return;
    await deleteAutomation(rule.id);
    await logAction({ action: 'deleted', resource: 'automation', detail: rule.name, actorId: user!.uid, actorName: me!.displayName });
    load();
  };

  const toggleLogs = async (ruleId: string) => {
    if (expandedLogs === ruleId) { setExpandedLogs(null); return; }
    setExpandedLogs(ruleId);
    setLogsLoading(true);
    setLogFilter('all');
    try {
      const data = await getAutomationLogs(ruleId, 20);
      setLogs(data as LogEntry[]);
    } catch { setLogs([]); }
    setLogsLoading(false);
  };

  const handleDuplicate = (rule: AutoRule) => {
    setEditingRule(null);
    setShowBuilder(true);
    // Pre-fill the builder with the rule's data (will be handled in BuilderModal)
    setTimeout(() => {
      setEditingRule({ ...rule, id: '', name: `${rule.name} (copy)` });
    }, 100);
  };

  const handleSave = async (data: any) => {
    await createAutomation({
      ...data,
      teamId: data.teamId || (activeTeamId === '__all__' ? '' : activeTeamId),
    });
    await logAction({ action: 'created', resource: 'automation', detail: data.name, actorId: user!.uid, actorName: me!.displayName });
    setShowBuilder(false);
    setEditingRule(null);
    load();
  };

  const handleTemplateSelect = (template: AutomationTemplate) => {
    setShowTemplatePicker(false);
    setEditingRule({
      id: '',
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      triggerConfig: {},
      conditions: template.conditions,
      actions: template.actions,
      enabled: true,
      teamId: activeTeamId === '__all__' ? '' : activeTeamId,
      runCount: 0,
      lastRunAt: null,
      createdAt: null,
    });
    setShowBuilder(true);
  };

  // Filter
  let filtered = rules.filter(r => {
    if (search && !r.name?.toLowerCase().includes(search.toLowerCase()) && !r.trigger?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEnabled === 'active' && !r.enabled) return false;
    if (filterEnabled === 'inactive' && r.enabled !== false) return false;
    return true;
  });

  const activeCount = rules.filter(r => r.enabled !== false).length;
  const totalRuns = rules.reduce((sum, r) => sum + (r.runCount || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Engine status banner */}
      <div className="mb-6 p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-start gap-3 anim-slide">
        <Zap className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-400">{t('automations.engineActiveTitle')}</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">{t('automations.engineActiveDesc')}</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-slide">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            {t('automations.title')}
            <span className="text-[12px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold">
              {t('automations.active', { n: activeCount })}
            </span>
          </h1>
          <p className="text-base text-[var(--text-muted)] mt-1">{t('automations.subtitle', { rules: rules.length, runs: totalRuns })}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && aiAutomationEnabled && (
            <button
              onClick={() => setShowAISuggestions(true)}
              className="flex items-center gap-2 px-4 h-10 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 font-medium transition text-sm"
              data-testid="ai-automation-btn"
            >
              <Sparkles className="h-4 w-4" /> AI Suggestions
            </button>
          )}
          {canManage && templatesEnabled && (
            <button onClick={() => setShowTemplatePicker(true)} className="flex items-center gap-2 px-4 h-10 rounded-md bg-[var(--bg-elevated)] shadow-card text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 font-medium transition text-sm">
              <ClipboardList className="h-4 w-4" /> {t('automations.templates') || 'Templates'}
            </button>
          )}
          {canManage && (
            <button onClick={() => { setEditingRule(null); setShowBuilder(true); }} className="flex items-center gap-2 px-5 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">
              <Plus className="h-4 w-4" /> {t('automations.newRule')}
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6 anim-slide" style={{ animationDelay: '40ms' }}>
        {[
          { label: t('automations.totalRules'), val: rules.length, color: '#3B82F6' },
          { label: t('automations.activeRules'), val: activeCount, color: '#22C55E' },
          { label: t('automations.inactiveRules'), val: rules.length - activeCount, color: '#64748B' },
          { label: t('automations.totalRuns'), val: totalRuns, color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl bg-[var(--bg-secondary)] shadow-card">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{s.val}</p>
            <p className="text-sm mt-0.5" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-5 anim-slide" style={{ animationDelay: '80ms' }}>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('automations.searchPlaceholder')} className="input-dark pl-10 h-9 text-sm" />
        </div>
        <select value={filterEnabled} onChange={e => setFilterEnabled(e.target.value as any)} className="select-dark h-9 text-sm">
          <option value="all">{t('automations.allRules')}</option>
          <option value="active">{t('automations.activeOnly')}</option>
          <option value="inactive">{t('automations.inactiveOnly')}</option>
        </select>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Zap className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm mb-2">{t('automations.noRules')}</p>
          {canManage && <button onClick={() => setShowBuilder(true)} className="text-sm text-[var(--accent)] hover:underline">{t('automations.createFirst')}</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rule, i) => {
            const triggerConf = TRIGGERS.find(t => t.id === rule.trigger);
            const ruleActions = (rule.actions || []).map(a => ACTIONS.find(ac => ac.id === a.type)).filter(Boolean);
            const ruleTeam = teams.find(t => t.id === rule.teamId);

            return (
              <div key={rule.id} className="rounded-xl bg-[var(--bg-secondary)] shadow-card overflow-hidden group anim-slide" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Enable/Disable toggle */}
                  <button onClick={() => toggleEnabled(rule)} className={`w-10 h-6 rounded-full flex items-center transition-all duration-200 shrink-0 ${rule.enabled !== false ? 'bg-emerald-500/20' : 'bg-[var(--bg-tertiary)]'}`}>
                    <div className={`w-5 h-5 rounded-full transition-all shadow ${rule.enabled !== false ? 'translate-x-[18px] bg-emerald-400' : 'translate-x-[2px] bg-gray-600'}`} />
                  </button>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${triggerConf?.color || '#F59E0B'}10`, border: `1px solid ${triggerConf?.color || '#F59E0B'}20` }}>
                    {triggerConf ? <triggerConf.icon className="h-5 w-5" style={{ color: triggerConf.color }} /> : <Zap className="h-5 w-5 text-amber-400" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${rule.enabled !== false ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{rule.name}</p>
                      {rule.enabled === false && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] font-semibold">{t('automations.disabled')}</span>}
                    </div>
                    {rule.description && <p className="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">{rule.description}</p>}

                    {/* Flow visualization */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[12px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-medium">
                        {triggerConf?.label || rule.trigger}
                      </span>

                      {(rule.conditions || []).length > 0 && (
                        <>
                          <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="text-[12px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-medium">
                            {t('automations.conditions', { n: rule.conditions.length })}
                          </span>
                        </>
                      )}

                      {(rule.actions || []).map((action, ai) => (
                        <span key={ai} className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="text-[12px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium">
                            {ACTIONS.find(a => a.id === action.type)?.label || action.type}
                          </span>
                        </span>
                      ))}

                      {/* Branch indicator */}
                      {(rule.branches || []).length > 0 && (
                        <span className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="text-[12px] px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 font-medium flex items-center gap-1">
                            <GitBranch className="h-3 w-3" /> {(rule.branches || []).length} {(rule.branches || []).length === 1 ? 'branch' : 'branches'}
                          </span>
                        </span>
                      )}

                      {/* Legacy support for simple trigger/action strings */}
                      {!(rule.actions || []).length && rule.trigger && (
                        <>
                          <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="text-[12px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium">
                            {(rule as any).action || t('automations.action')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {ruleTeam && <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${ruleTeam.color}15`, color: ruleTeam.color }}>{ruleTeam.icon} {ruleTeam.name}</span>}
                    {rule.runCount > 0 && <span className="text-[12px] text-[var(--text-muted)]">{t('automations.runs', { n: rule.runCount })}</span>}
                    {(rule.errorCount || 0) > 0 && <span className="text-[12px] text-red-400">{t('automations.errors', { n: rule.errorCount || 0 })}</span>}
                    {rule.lastRunAt && <span className="text-[12px] text-[var(--text-muted)]">{t('automations.lastRun', { date: rule.lastRunAt?.toDate?.()?.toLocaleDateString?.() || '—' })}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button onClick={() => toggleLogs(rule.id)} className={`p-2 rounded-lg ${expandedLogs === rule.id ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--accent)]'}`} title={t('automations.executionHistory')}><History className="h-4 w-4" /></button>
                    <button onClick={() => handleDuplicate(rule)} className="p-2 text-[var(--text-muted)] hover:text-blue-400 rounded-lg" title={t('automations.duplicate')}><Copy className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(rule)} className="p-2 text-[var(--text-muted)] hover:text-red-400 rounded-lg" title={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {/* Execution Log Viewer */}
                {expandedLogs === rule.id && (
                  <div className="border-t border-[var(--border-primary)] px-5 py-4 bg-[var(--bg-base)]/50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-semibold text-[var(--text-secondary)]">{t('automations.executionHistory')}</p>
                      <div className="flex gap-1">
                        {(['all', 'success', 'failure', 'skipped'] as const).map(f => (
                          <button key={f} onClick={() => setLogFilter(f)}
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition ${logFilter === f ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                            {t(`automations.filter${f.charAt(0).toUpperCase() + f.slice(1)}` as any)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {logsLoading ? (
                      <div className="space-y-2">{[1, 2, 3].map(k => <div key={k} className="h-10 skeleton rounded-lg" />)}</div>
                    ) : logs.filter(l => logFilter === 'all' || l.status === logFilter).length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)] py-4 text-center">{t('automations.noExecutions')}</p>
                    ) : (
                      <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        {logs.filter(l => logFilter === 'all' || l.status === logFilter).map(log => (
                          <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-elevated)] text-[13px]">
                            <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-bold ${log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : log.status === 'failure' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>
                              {log.status === 'success' ? t('automations.logSuccess') : log.status === 'failure' ? t('automations.logFailure') : t('automations.logSkipped')}
                            </span>
                            <div className="flex-1 min-w-0">
                              {log.triggerData?.taskTitle && <p className="text-[var(--text-secondary)] truncate">{t('automations.logTask', { title: log.triggerData.taskTitle })}</p>}
                              {log.actionsExecuted && log.actionsExecuted.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {log.actionsExecuted.map((a, ai) => (
                                    <span key={ai} className={`text-[11px] px-1.5 py-0.5 rounded ${a.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                      {ACTIONS.find(ac => ac.id === a.actionType)?.label || a.actionType}{a.error ? `: ${a.error.slice(0, 60)}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {log.error && <p className="text-red-400 text-[12px] mt-1 truncate">{log.error}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0 text-[var(--text-muted)]">
                              <span className="text-[11px]">{log.createdAt?.toDate?.()?.toLocaleString?.() || '—'}</span>
                              {log.duration != null && <span className="text-[11px]">{t('automations.logDuration', { ms: log.duration })}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Has More indicator */}
      {hasMore && !loading && (
        <div className="text-center py-4 mt-2">
          <span className="text-[13px] text-[var(--text-muted)]">
            {t('common.showingItems', { n: rules.length })} — {t('common.moreAvailable')}
          </span>
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && (
        <BuilderModal
          teams={teams}
          members={[]}
          initialData={editingRule}
          activeTeamId={activeTeamId}
          branchingEnabled={branchingEnabled}
          onClose={() => { setShowBuilder(false); setEditingRule(null); }}
          onSave={handleSave}
        />
      )}

      {/* Template Picker Modal */}
      {templatesEnabled && (
        <AutomationTemplatePicker
          open={showTemplatePicker}
          onClose={() => setShowTemplatePicker(false)}
          onSelect={handleTemplateSelect}
        />
      )}

      {/* AI Suggestions Panel */}
      {aiAutomationEnabled && showAISuggestions && (
        <AISuggestionsPanel
          onCreateAutomation={(data) => {
            setShowAISuggestions(false);
            setEditingRule({
              id: '',
              name: data.name,
              description: data.description,
              trigger: data.trigger || 'task_created',
              triggerConfig: {},
              conditions: [],
              actions: data.actions.map((a, i) => ({ id: `ai_${i}`, type: 'add_comment', config: { text: a } })),
              enabled: true,
              teamId: activeTeamId === '__all__' ? '' : activeTeamId,
              runCount: 0,
              lastRunAt: null,
              createdAt: null,
            });
            setShowBuilder(true);
          }}
          onClose={() => setShowAISuggestions(false)}
        />
      )}
    </div>
  );
}

// === BUILDER MODAL ===
function BuilderModal({ teams, members, initialData, activeTeamId, branchingEnabled, onClose, onSave }: {
  teams: any[]; members: any[]; initialData: AutoRule | null; activeTeamId: string; branchingEnabled: boolean;
  onClose: () => void; onSave: (data: any) => void;
}) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [trigger, setTrigger] = useState(initialData?.trigger || '');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>(initialData?.triggerConfig || {});
  const [conditions, setConditions] = useState<Condition[]>(initialData?.conditions || []);
  const [actions, setActions] = useState<Action[]>(initialData?.actions || []);
  const [branches, setBranches] = useState<BranchBlock[]>(initialData?.branches || []);
  const [teamId, setTeamId] = useState(initialData?.teamId || (activeTeamId === '__all__' ? '' : activeTeamId));
  const [step, setStep] = useState(0); // 0=trigger, 1=conditions, 2=actions, 3=review

  const addCondition = () => {
    setConditions([...conditions, { id: Date.now().toString(), field: 'status', operator: 'equals', value: '' }]);
  };
  const removeCondition = (id: string) => setConditions(conditions.filter(c => c.id !== id));
  const updateCondition = (id: string, field: string, val: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const addAction = (type: string) => {
    setActions([...actions, { id: Date.now().toString(), type, config: {} }]);
  };
  const removeAction = (id: string) => setActions(actions.filter(a => a.id !== id));
  const updateActionConfig = (id: string, key: string, val: string) => {
    setActions(actions.map(a => a.id === id ? { ...a, config: { ...a.config, [key]: val } } : a));
  };

  // Validate all action config fields are filled
  const actionsConfigured = actions.length > 0 && actions.every(a => {
    const conf = ACTIONS.find(ac => ac.id === a.type);
    if (!conf?.configFields?.length) return true;
    return conf.configFields.every(f => a.config[f.key]?.trim());
  });
  const triggerNotComingSoon = trigger && !TRIGGERS.find(t => t.id === trigger && (t as any).comingSoon);
  const canSubmit = !!(name.trim() && triggerNotComingSoon && actionsConfigured);
  const triggerConf = TRIGGERS.find(t => t.id === trigger);

  const submit = () => {
    if (!canSubmit) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      trigger,
      triggerConfig,
      conditions,
      actions,
      ...(branches.length > 0 ? { branches } : {}),
      teamId,
      enabled: true,
      runCount: 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[var(--bg-base)] rounded-xl shadow-modal anim-slide">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center"><Zap className="h-4 w-4 text-amber-400" /></div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('automations.builder')}</h2>
              <p className="text-[13px] text-[var(--text-muted)]">{t('automations.whenIfThen')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-5 py-3">
          {[t('automations.trigger'), t('automations.conditionsStep'), t('automations.actions'), t('automations.review')].map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${step === i ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : step > i ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold ${step === i ? 'bg-[var(--accent)] text-[var(--accent-text)]' : step > i ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{step > i ? '✓' : i + 1}</span>
              {s}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* Name + Description (always visible) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">{t('automations.ruleName')}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('automations.ruleNamePlaceholder')} autoFocus className="input-dark text-sm" />
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">{t('automations.department')}</label>
              <select value={teamId} onChange={e => setTeamId(e.target.value)} className="select-dark w-full">
                <option value="">{t('automations.allDepartments')}</option>
                {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.icon} {tm.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">{t('automations.description')}</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('automations.whatDoes')} className="input-dark text-sm" />
          </div>

          {/* STEP 0: TRIGGER */}
          {step === 0 && (
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[#3B82F6] mb-2 font-semibold">{t('automations.when')}</label>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGERS.map(tr => {
                  const disabled = (tr as any).comingSoon;
                  return (
                    <button key={tr.id} onClick={() => !disabled && setTrigger(tr.id)} disabled={disabled}
                      className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${trigger === tr.id ? 'shadow-card' : 'bg-[var(--bg-elevated)] hover:shadow-card-hover'}`}
                      style={trigger === tr.id && !disabled ? { backgroundColor: `${tr.color}08`, borderColor: `${tr.color}30` } : {}}>
                      <tr.icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: tr.color }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold ${trigger === tr.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{tr.label}</p>
                          {disabled && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">COMING SOON</span>}
                        </div>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">{tr.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 1: CONDITIONS */}
          {step === 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] uppercase tracking-wider text-amber-400 font-semibold">{t('automations.if')}</label>
                <button onClick={addCondition} className="flex items-center gap-1 px-3 h-7 rounded-lg bg-amber-500/10 text-amber-400 text-[13px] font-medium hover:bg-amber-500/20 transition-all duration-200">
                  <Plus className="h-3 w-3" /> {t('automations.addCondition')}
                </button>
              </div>
              {conditions.length === 0 ? (
                <div className="text-center py-8 rounded-xl bg-[var(--bg-elevated)]/50">
                  <Filter className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--text-muted)]">{t('automations.noConditions')}</p>
                  <button onClick={addCondition} className="text-sm text-amber-400 hover:underline mt-2">{t('automations.addFilter')}</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {conditions.map((cond, ci) => (
                    <div key={cond.id} className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-elevated)]">
                      {ci > 0 && <span className="text-[12px] text-amber-400 font-bold px-2">AND</span>}
                      <select value={cond.field} onChange={e => updateCondition(cond.id, 'field', e.target.value)} className="select-dark h-8 text-[13px] flex-1">
                        {CONDITION_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                      <select value={cond.operator} onChange={e => updateCondition(cond.id, 'operator', e.target.value)} className="select-dark h-8 text-[13px] w-32">
                        {CONDITION_OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      {(() => {
                        const fieldConf = CONDITION_FIELDS.find(f => f.id === cond.field);
                        if (fieldConf?.options) {
                          return <select value={cond.value} onChange={e => updateCondition(cond.id, 'value', e.target.value)} className="select-dark h-8 text-[13px] flex-1">
                            <option value="">{t('automations.select')}</option>
                            {fieldConf.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>;
                        }
                        return <input value={cond.value} onChange={e => updateCondition(cond.id, 'value', e.target.value)} placeholder={t('automations.value')} className="input-dark h-8 text-[13px] flex-1" />;
                      })()}
                      <button onClick={() => removeCondition(cond.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ACTIONS */}
          {step === 2 && (
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-emerald-400 mb-2 font-semibold">{t('automations.then')}</label>
              {actions.length > 0 && (
                <div className="space-y-2 mb-4">
                  {actions.map((action, ai) => {
                    const actionConf = ACTIONS.find(a => a.id === action.type);
                    return (
                      <div key={action.id} className="p-3 rounded-xl bg-[var(--bg-elevated)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[12px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">{ai + 1}</span>
                          {actionConf && <actionConf.icon className="h-4 w-4" style={{ color: actionConf.color }} />}
                          <span className="text-sm font-semibold text-[var(--text-secondary)]">{actionConf?.label || action.type}</span>
                          <div className="flex-1" />
                          <button onClick={() => removeAction(action.id)} className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded"><X className="h-3.5 w-3.5" /></button>
                        </div>
                        {/* Config fields */}
                        {actionConf?.configFields?.map(field => (
                          <div key={field.key} className="mt-2">
                            <label className="block text-[12px] text-[var(--text-muted)] mb-1">{field.label}</label>
                            {(field as any).options ? (
                              <select value={action.config[field.key] || ''} onChange={e => updateActionConfig(action.id, field.key, e.target.value)} className="select-dark h-8 text-[13px] w-full">
                                <option value="">{t('automations.select')}</option>
                                {(field as any).options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input value={action.config[field.key] || ''} onChange={e => updateActionConfig(action.id, field.key, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} className="input-dark h-8 text-[13px]" />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map(a => (
                  <button key={a.id} onClick={() => addAction(a.id)}
                    className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-elevated)] hover:shadow-card-hover text-left transition-all duration-200">
                    <a.icon className="h-4 w-4 shrink-0" style={{ color: a.color }} />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-secondary)]">{a.label}</p>
                      <p className="text-sm text-[var(--text-muted)]">{a.desc}</p>
                    </div>
                    <Plus className="h-3 w-3 text-[var(--text-muted)] ml-auto shrink-0" />
                  </button>
                ))}
              </div>

              {/* Branch blocks (if/then/else) */}
              {branchingEnabled && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5" />
                      {lang === 'es' ? 'Ramificaciones' : 'Branches'}
                    </label>
                    <button
                      onClick={() => setBranches([...branches, { id: Date.now().toString(), conditions: [{ field: 'status', operator: 'equals', value: '' }], thenActions: [], elseActions: [] }])}
                      className="flex items-center gap-1 px-3 h-7 rounded-lg bg-purple-500/10 text-purple-400 text-[13px] font-medium hover:bg-purple-500/20 transition"
                    >
                      <Plus className="h-3 w-3" /> {lang === 'es' ? 'Agregar rama' : 'Add Branch'}
                    </button>
                  </div>

                  {branches.length === 0 ? (
                    <div className="text-center py-6 rounded-xl bg-[var(--bg-elevated)]/50">
                      <GitBranch className="h-6 w-6 text-[var(--text-muted)] mx-auto mb-2" />
                      <p className="text-[13px] text-[var(--text-muted)]">
                        {lang === 'es' ? 'Agrega ramas para ejecutar acciones condicionalmente' : 'Add branches for conditional action execution'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {branches.map((branch, bi) => (
                        <div key={branch.id} className="rounded-xl border border-purple-500/20 bg-purple-500/[0.03] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-purple-400">
                              {lang === 'es' ? `RAMA ${bi + 1}` : `BRANCH ${bi + 1}`}
                            </span>
                            <button onClick={() => setBranches(branches.filter(b => b.id !== branch.id))} className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Branch conditions */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-amber-400 font-semibold uppercase">
                                {lang === 'es' ? 'Si' : 'If'}
                              </span>
                              <button
                                onClick={() => {
                                  const updated = [...branches];
                                  updated[bi] = { ...branch, conditions: [...branch.conditions, { field: 'status', operator: 'equals', value: '' }] };
                                  setBranches(updated);
                                }}
                                className="text-[11px] text-amber-400 hover:underline"
                              >
                                + {lang === 'es' ? 'Condición' : 'Condition'}
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {branch.conditions.map((cond, ci) => (
                                <div key={ci} className="flex items-center gap-1.5">
                                  {ci > 0 && <span className="text-[10px] text-amber-400 font-bold px-1">AND</span>}
                                  <select
                                    value={cond.field}
                                    onChange={e => {
                                      const updated = [...branches];
                                      updated[bi].conditions[ci] = { ...cond, field: e.target.value };
                                      setBranches(updated);
                                    }}
                                    className="select-dark h-7 text-[12px] flex-1"
                                  >
                                    {CONDITION_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                  </select>
                                  <select
                                    value={cond.operator}
                                    onChange={e => {
                                      const updated = [...branches];
                                      updated[bi].conditions[ci] = { ...cond, operator: e.target.value };
                                      setBranches(updated);
                                    }}
                                    className="select-dark h-7 text-[12px] w-28"
                                  >
                                    {CONDITION_OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                  </select>
                                  {(() => {
                                    const fieldConf = CONDITION_FIELDS.find(f => f.id === cond.field);
                                    if (fieldConf?.options) {
                                      return (
                                        <select
                                          value={cond.value}
                                          onChange={e => {
                                            const updated = [...branches];
                                            updated[bi].conditions[ci] = { ...cond, value: e.target.value };
                                            setBranches(updated);
                                          }}
                                          className="select-dark h-7 text-[12px] flex-1"
                                        >
                                          <option value="">—</option>
                                          {fieldConf.options.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      );
                                    }
                                    return (
                                      <input
                                        value={cond.value}
                                        onChange={e => {
                                          const updated = [...branches];
                                          updated[bi].conditions[ci] = { ...cond, value: e.target.value };
                                          setBranches(updated);
                                        }}
                                        placeholder="value"
                                        className="input-dark h-7 text-[12px] flex-1"
                                      />
                                    );
                                  })()}
                                  <button
                                    onClick={() => {
                                      const updated = [...branches];
                                      updated[bi] = { ...branch, conditions: branch.conditions.filter((_, i) => i !== ci) };
                                      setBranches(updated);
                                    }}
                                    className="p-1 text-[var(--text-muted)] hover:text-red-400"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Then actions */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-emerald-400 font-semibold uppercase">
                                {lang === 'es' ? 'Entonces' : 'Then'}
                              </span>
                              <select
                                value=""
                                onChange={e => {
                                  if (!e.target.value) return;
                                  const updated = [...branches];
                                  updated[bi] = { ...branch, thenActions: [...branch.thenActions, { id: Date.now().toString(), type: e.target.value, config: {} }] };
                                  setBranches(updated);
                                  e.target.value = '';
                                }}
                                className="select-dark h-6 text-[11px] w-32"
                              >
                                <option value="">+ {lang === 'es' ? 'Acción' : 'Action'}</option>
                                {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                              </select>
                            </div>
                            {branch.thenActions.length === 0 ? (
                              <p className="text-[11px] text-[var(--text-muted)] py-1">{lang === 'es' ? 'Sin acciones' : 'No actions'}</p>
                            ) : (
                              <div className="space-y-1">
                                {branch.thenActions.map((a, ai) => {
                                  const ac = ACTIONS.find(x => x.id === a.type);
                                  return (
                                    <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/5 text-[12px]">
                                      {ac && <ac.icon className="h-3 w-3" style={{ color: ac.color }} />}
                                      <span className="text-[var(--text-secondary)] flex-1">{ac?.label || a.type}</span>
                                      <button
                                        onClick={() => {
                                          const updated = [...branches];
                                          updated[bi] = { ...branch, thenActions: branch.thenActions.filter(x => x.id !== a.id) };
                                          setBranches(updated);
                                        }}
                                        className="p-0.5 text-[var(--text-muted)] hover:text-red-400"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Else actions */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-red-400 font-semibold uppercase">
                                {lang === 'es' ? 'Si no' : 'Else'}
                              </span>
                              <select
                                value=""
                                onChange={e => {
                                  if (!e.target.value) return;
                                  const updated = [...branches];
                                  updated[bi] = { ...branch, elseActions: [...branch.elseActions, { id: Date.now().toString(), type: e.target.value, config: {} }] };
                                  setBranches(updated);
                                  e.target.value = '';
                                }}
                                className="select-dark h-6 text-[11px] w-32"
                              >
                                <option value="">+ {lang === 'es' ? 'Acción' : 'Action'}</option>
                                {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                              </select>
                            </div>
                            {branch.elseActions.length === 0 ? (
                              <p className="text-[11px] text-[var(--text-muted)] py-1">{lang === 'es' ? 'Sin acciones' : 'No actions'}</p>
                            ) : (
                              <div className="space-y-1">
                                {branch.elseActions.map((a, ai) => {
                                  const ac = ACTIONS.find(x => x.id === a.type);
                                  return (
                                    <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/5 text-[12px]">
                                      {ac && <ac.icon className="h-3 w-3" style={{ color: ac.color }} />}
                                      <span className="text-[var(--text-secondary)] flex-1">{ac?.label || a.type}</span>
                                      <button
                                        onClick={() => {
                                          const updated = [...branches];
                                          updated[bi] = { ...branch, elseActions: branch.elseActions.filter(x => x.id !== a.id) };
                                          setBranches(updated);
                                        }}
                                        className="p-0.5 text-[var(--text-muted)] hover:text-red-400"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 3 && (
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--accent)] mb-3 font-semibold">{t('automations.review').toUpperCase()}</label>
              <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-subtle)] p-5 space-y-4">
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{name || 'Unnamed Rule'}</p>
                  {description && <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[13px] px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-semibold">WHEN: {triggerConf?.label || trigger}</span>
                  {conditions.length > 0 && <span className="text-[13px] px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-semibold">IF: {conditions.length} condition{conditions.length !== 1 ? 's' : ''}</span>}
                  {actions.map((a, i) => {
                    const ac = ACTIONS.find(x => x.id === a.type);
                    return <span key={i} className="text-[13px] px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold">THEN: {ac?.label || a.type}</span>;
                  })}
                  {branches.length > 0 && (
                    <span className="text-[13px] px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 font-semibold flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5" /> {branches.length} {lang === 'es' ? (branches.length === 1 ? 'rama' : 'ramas') : (branches.length === 1 ? 'branch' : 'branches')}
                    </span>
                  )}
                </div>

                {/* Branch review details */}
                {branches.length > 0 && (
                  <div className="space-y-3 mt-2">
                    {branches.map((branch, bi) => (
                      <div key={branch.id} className="rounded-lg border border-purple-500/20 bg-purple-500/[0.03] p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-[12px] font-bold text-purple-400">{lang === 'es' ? `RAMA ${bi + 1}` : `BRANCH ${bi + 1}`}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                            IF: {branch.conditions.map(c => {
                              const f = CONDITION_FIELDS.find(x => x.id === c.field);
                              const o = CONDITION_OPS.find(x => x.id === c.operator);
                              return `${f?.label || c.field} ${o?.label || c.operator} ${c.value || '…'}`;
                            }).join(' AND ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {branch.thenActions.length > 0 && branch.thenActions.map((a, ai) => {
                            const ac = ACTIONS.find(x => x.id === a.type);
                            return <span key={ai} className="text-[12px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">THEN: {ac?.label || a.type}</span>;
                          })}
                          {branch.elseActions.length > 0 && branch.elseActions.map((a, ai) => {
                            const ac = ACTIONS.find(x => x.id === a.type);
                            return <span key={ai} className="text-[12px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">ELSE: {ac?.label || a.type}</span>;
                          })}
                          {branch.thenActions.length === 0 && branch.elseActions.length === 0 && (
                            <span className="text-[12px] text-[var(--text-muted)] italic">{lang === 'es' ? 'Sin acciones configuradas' : 'No actions configured'}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!canSubmit && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <p className="text-sm text-red-400">{t('automations.missingFields', { fields: [!name.trim() ? t('automations.ruleName') : '', !triggerNotComingSoon ? t('automations.trigger') : '', actions.length === 0 ? t('automations.actions') : '', !actionsConfigured && actions.length > 0 ? 'Action config' : ''].filter(Boolean).join(', ') })}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5">
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose} className="px-5 h-10 rounded-md bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">
            {step > 0 ? t('common.back') : t('common.cancel')}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} className="px-6 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">{t('common.next')}</button>
            ) : (
              <button onClick={submit} disabled={!canSubmit} className="px-6 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40">{t('automations.createAutomation')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
