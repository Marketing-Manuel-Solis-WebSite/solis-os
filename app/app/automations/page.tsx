'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { getAutomations, createAutomation, updateAutomation, deleteAutomation, logAction } from '@/lib/db';
import {
  Plus, Trash2, Zap, ArrowRight, Power, PowerOff, ChevronDown, ChevronRight,
  Play, Pause, Filter, Clock, CheckSquare, Bell, Mail, MessageSquare, Bot,
  Users, Tag, Calendar, AlertTriangle, Edit2, Copy, Search, X, Settings
} from 'lucide-react';

// === TRIGGER CONFIGS ===
const TRIGGERS = [
  { id: 'task_created', label: 'Task Created', icon: Plus, color: '#22C55E', desc: 'When a new task is created' },
  { id: 'task_status_changed', label: 'Status Changed', icon: CheckSquare, color: '#3B82F6', desc: 'When a task status changes' },
  { id: 'task_assigned', label: 'Task Assigned', icon: Users, color: '#A855F7', desc: 'When someone is assigned to a task' },
  { id: 'task_due_approaching', label: 'Due Approaching', icon: Clock, color: '#F59E0B', desc: 'When a task due date is approaching' },
  { id: 'task_overdue', label: 'Task Overdue', icon: AlertTriangle, color: '#EF4444', desc: 'When a task passes its due date' },
  { id: 'schedule_daily', label: 'Daily Schedule', icon: Calendar, color: '#06B6D4', desc: 'Run every day at a specific time' },
  { id: 'schedule_weekly', label: 'Weekly Schedule', icon: Calendar, color: '#8B5CF6', desc: 'Run every week on a specific day' },
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
  { id: 'is_empty', label: 'is empty' },
];

// === ACTION CONFIGS ===
const ACTIONS = [
  { id: 'change_status', label: 'Change Status', icon: CheckSquare, color: '#3B82F6', desc: 'Update task status', configFields: [{ key: 'toStatus', label: 'New Status', options: ['todo', 'in_progress', 'in_review', 'done', 'blocked'] }] },
  { id: 'set_priority', label: 'Set Priority', icon: Tag, color: '#F59E0B', desc: 'Update task priority', configFields: [{ key: 'toPriority', label: 'New Priority', options: ['urgent', 'high', 'medium', 'low'] }] },
  { id: 'assign_user', label: 'Assign User', icon: Users, color: '#A855F7', desc: 'Assign a team member', configFields: [{ key: 'assigneeId', label: 'User', type: 'member' }] },
  { id: 'add_tag', label: 'Add Tag', icon: Tag, color: '#22C55E', desc: 'Add a tag to the task', configFields: [{ key: 'tagName', label: 'Tag', type: 'text' }] },
  { id: 'post_comment', label: 'Post Comment', icon: MessageSquare, color: '#06B6D4', desc: 'Auto-comment on the task', configFields: [{ key: 'commentText', label: 'Comment', type: 'text' }] },
  { id: 'send_notification', label: 'Send Notification', icon: Bell, color: '#EC4899', desc: 'Notify team members', configFields: [{ key: 'message', label: 'Message', type: 'text' }] },
  { id: 'ai_summary', label: 'AI Summary', icon: Bot, color: '#3B82F6', desc: 'Generate an AI summary', configFields: [] },
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

interface AutoRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerConfig: Record<string, string>;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
  teamId: string;
  runCount: number;
  lastRunAt: any;
  createdAt: any;
}

// === MAIN ===
export default function AutomationsPage() {
  const { user, me, activeTeamId, teams, can } = useAuth();
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null);
  const [search, setSearch] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'active' | 'inactive'>('all');

  const canManage = can('automation', 'create');

  const load = useCallback(async () => {
    const r = await getAutomations(activeTeamId);
    setRules(r as AutoRule[]);
    setLoading(false);
  }, [activeTeamId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const toggleEnabled = async (rule: AutoRule) => {
    await updateAutomation(rule.id, { enabled: !rule.enabled });
    load();
  };

  const handleDelete = async (rule: AutoRule) => {
    if (!confirm(`Delete automation "${rule.name}"?`)) return;
    await deleteAutomation(rule.id);
    await logAction({ action: 'deleted', resource: 'automation', detail: rule.name, actorId: user!.uid, actorName: me!.displayName });
    load();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-slide">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            Automations
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold">
              {activeCount} ACTIVE
            </span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{rules.length} rules · {totalRuns} total runs</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditingRule(null); setShowBuilder(true); }} className="flex items-center gap-2 px-5 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">
            <Plus className="h-4 w-4" /> New Rule
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6 anim-slide" style={{ animationDelay: '40ms' }}>
        {[
          { label: 'Total Rules', val: rules.length, color: '#3B82F6' },
          { label: 'Active', val: activeCount, color: '#22C55E' },
          { label: 'Inactive', val: rules.length - activeCount, color: '#64748B' },
          { label: 'Total Runs', val: totalRuns, color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl bg-[var(--bg-secondary)] shadow-card">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{s.val}</p>
            <p className="text-[10px] mt-0.5" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-5 anim-slide" style={{ animationDelay: '80ms' }}>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search automations..." className="input-dark pl-10 h-9 text-sm" />
        </div>
        <select value={filterEnabled} onChange={e => setFilterEnabled(e.target.value as any)} className="select-dark h-9 text-xs">
          <option value="all">All Rules</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Zap className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm mb-2">No automations found.</p>
          {canManage && <button onClick={() => setShowBuilder(true)} className="text-sm text-[var(--accent)] hover:underline">Create your first automation</button>}
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
                      {rule.enabled === false && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] font-semibold">DISABLED</span>}
                    </div>
                    {rule.description && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{rule.description}</p>}

                    {/* Flow visualization */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-medium">
                        {triggerConf?.label || rule.trigger}
                      </span>

                      {(rule.conditions || []).length > 0 && (
                        <>
                          <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-medium">
                            {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}

                      {(rule.actions || []).map((action, ai) => (
                        <span key={ai} className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium">
                            {ACTIONS.find(a => a.id === action.type)?.label || action.type}
                          </span>
                        </span>
                      ))}

                      {/* Legacy support for simple trigger/action strings */}
                      {!(rule.actions || []).length && rule.trigger && (
                        <>
                          <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium">
                            {(rule as any).action || 'Action'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {ruleTeam && <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${ruleTeam.color}15`, color: ruleTeam.color }}>{ruleTeam.icon} {ruleTeam.name}</span>}
                    {rule.runCount > 0 && <span className="text-[10px] text-[var(--text-muted)]">{rule.runCount} runs</span>}
                    {rule.lastRunAt && <span className="text-[10px] text-[var(--text-muted)]">Last: {rule.lastRunAt?.toDate?.()?.toLocaleDateString?.() || '—'}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button onClick={() => handleDuplicate(rule)} className="p-2 text-[var(--text-muted)] hover:text-blue-400 rounded-lg" title="Duplicate"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(rule)} className="p-2 text-[var(--text-muted)] hover:text-red-400 rounded-lg" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && (
        <BuilderModal
          teams={teams}
          members={[]}
          initialData={editingRule}
          activeTeamId={activeTeamId}
          onClose={() => { setShowBuilder(false); setEditingRule(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// === BUILDER MODAL ===
function BuilderModal({ teams, members, initialData, activeTeamId, onClose, onSave }: {
  teams: any[]; members: any[]; initialData: AutoRule | null; activeTeamId: string;
  onClose: () => void; onSave: (data: any) => void;
}) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [trigger, setTrigger] = useState(initialData?.trigger || '');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>(initialData?.triggerConfig || {});
  const [conditions, setConditions] = useState<Condition[]>(initialData?.conditions || []);
  const [actions, setActions] = useState<Action[]>(initialData?.actions || []);
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

  const canSubmit = name.trim() && trigger && actions.length > 0;
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
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Automation Builder</h2>
              <p className="text-[11px] text-[var(--text-muted)]">When → If → Then</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-5 py-3">
          {['Trigger', 'Conditions', 'Actions', 'Review'].map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${step === i ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : step > i ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === i ? 'bg-[var(--accent)] text-[var(--accent-text)]' : step > i ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{step > i ? '✓' : i + 1}</span>
              {s}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* Name + Description (always visible) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Rule Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Auto-assign urgent tasks" autoFocus className="input-dark text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Department</label>
              <select value={teamId} onChange={e => setTeamId(e.target.value)} className="select-dark w-full">
                <option value="">All Departments</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this rule do?" className="input-dark text-sm" />
          </div>

          {/* STEP 0: TRIGGER */}
          {step === 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#3B82F6] mb-2 font-semibold">WHEN (Trigger)</label>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGERS.map(t => (
                  <button key={t.id} onClick={() => setTrigger(t.id)}
                    className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200 ${trigger === t.id ? 'shadow-card' : 'bg-[var(--bg-elevated)] hover:shadow-card-hover'}`}
                    style={trigger === t.id ? { backgroundColor: `${t.color}08`, borderColor: `${t.color}30` } : {}}>
                    <t.icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: t.color }} />
                    <div>
                      <p className={`text-xs font-semibold ${trigger === t.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{t.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: CONDITIONS */}
          {step === 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">IF (Conditions) — Optional</label>
                <button onClick={addCondition} className="flex items-center gap-1 px-3 h-7 rounded-lg bg-amber-500/10 text-amber-400 text-[11px] font-medium hover:bg-amber-500/20 transition-all duration-200">
                  <Plus className="h-3 w-3" /> Add Condition
                </button>
              </div>
              {conditions.length === 0 ? (
                <div className="text-center py-8 rounded-xl bg-[var(--bg-elevated)]/50">
                  <Filter className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
                  <p className="text-xs text-[var(--text-muted)]">No conditions. Rule will trigger for all matching events.</p>
                  <button onClick={addCondition} className="text-xs text-amber-400 hover:underline mt-2">Add a filter condition</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {conditions.map((cond, ci) => (
                    <div key={cond.id} className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-elevated)]">
                      {ci > 0 && <span className="text-[10px] text-amber-400 font-bold px-2">AND</span>}
                      <select value={cond.field} onChange={e => updateCondition(cond.id, 'field', e.target.value)} className="select-dark h-8 text-[11px] flex-1">
                        {CONDITION_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                      <select value={cond.operator} onChange={e => updateCondition(cond.id, 'operator', e.target.value)} className="select-dark h-8 text-[11px] w-32">
                        {CONDITION_OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      {(() => {
                        const fieldConf = CONDITION_FIELDS.find(f => f.id === cond.field);
                        if (fieldConf?.options) {
                          return <select value={cond.value} onChange={e => updateCondition(cond.id, 'value', e.target.value)} className="select-dark h-8 text-[11px] flex-1">
                            <option value="">Select...</option>
                            {fieldConf.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>;
                        }
                        return <input value={cond.value} onChange={e => updateCondition(cond.id, 'value', e.target.value)} placeholder="Value..." className="input-dark h-8 text-[11px] flex-1" />;
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
              <label className="block text-[10px] uppercase tracking-wider text-emerald-400 mb-2 font-semibold">THEN (Actions)</label>
              {actions.length > 0 && (
                <div className="space-y-2 mb-4">
                  {actions.map((action, ai) => {
                    const actionConf = ACTIONS.find(a => a.id === action.type);
                    return (
                      <div key={action.id} className="p-3 rounded-xl bg-[var(--bg-elevated)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">{ai + 1}</span>
                          {actionConf && <actionConf.icon className="h-4 w-4" style={{ color: actionConf.color }} />}
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">{actionConf?.label || action.type}</span>
                          <div className="flex-1" />
                          <button onClick={() => removeAction(action.id)} className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded"><X className="h-3.5 w-3.5" /></button>
                        </div>
                        {/* Config fields */}
                        {actionConf?.configFields?.map(field => (
                          <div key={field.key} className="mt-2">
                            <label className="block text-[10px] text-[var(--text-muted)] mb-1">{field.label}</label>
                            {(field as any).options ? (
                              <select value={action.config[field.key] || ''} onChange={e => updateActionConfig(action.id, field.key, e.target.value)} className="select-dark h-8 text-[11px] w-full">
                                <option value="">Select...</option>
                                {(field as any).options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input value={action.config[field.key] || ''} onChange={e => updateActionConfig(action.id, field.key, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} className="input-dark h-8 text-[11px]" />
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
                      <p className="text-xs font-medium text-[var(--text-secondary)]">{a.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{a.desc}</p>
                    </div>
                    <Plus className="h-3 w-3 text-[var(--text-muted)] ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 3 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--accent)] mb-3 font-semibold">REVIEW</label>
              <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-subtle)] p-5 space-y-4">
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{name || 'Unnamed Rule'}</p>
                  {description && <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-semibold">WHEN: {triggerConf?.label || trigger}</span>
                  {conditions.length > 0 && <span className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-semibold">IF: {conditions.length} condition{conditions.length !== 1 ? 's' : ''}</span>}
                  {actions.map((a, i) => {
                    const ac = ACTIONS.find(x => x.id === a.type);
                    return <span key={i} className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold">THEN: {ac?.label || a.type}</span>;
                  })}
                </div>

                {!canSubmit && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <p className="text-xs text-red-400">Missing required fields: {!name.trim() ? 'Name, ' : ''}{!trigger ? 'Trigger, ' : ''}{actions.length === 0 ? 'At least one action' : ''}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5">
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose} className="px-5 h-10 rounded-md bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">
            {step > 0 ? '← Back' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} className="px-6 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">Next →</button>
            ) : (
              <button onClick={submit} disabled={!canSubmit} className="px-6 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40">Create Automation</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
