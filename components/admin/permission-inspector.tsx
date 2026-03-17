'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  simulateAccess,
  simulateFieldAccess,
  simulateTree,
  withRole,
  summarizeTree,
  type SimulationContext,
  type ResourceNode,
  type TreeAccessResult,
  type AccessResult,
} from '@/lib/permission-simulator';
import { getUserPermissionProfile, getFieldRestrictions } from '@/lib/permissions-granular';
import type { PermissionOverride, FieldRestriction, ScopedPermission } from '@/lib/permissions-granular';
import { getSettings } from '@/lib/db';
import type { Role } from '@/lib/auth-utils';
import {
  Shield, ChevronRight, ChevronDown, Eye, EyeOff, Pencil, Trash2,
  Search, Users, FolderOpen, List, FileText, MessageSquare, Target,
  Zap, PenTool, ClipboardList, LayoutDashboard, CheckCircle2, XCircle,
  AlertTriangle, Info, Download, RefreshCw, User,
} from 'lucide-react';

// ---- Icon map ----

const TYPE_ICONS: Record<string, any> = {
  space: Users,
  folder: FolderOpen,
  list: List,
  task: CheckCircle2,
  doc: FileText,
  channel: MessageSquare,
  goal: Target,
  automation: Zap,
  whiteboard: PenTool,
  form: ClipboardList,
  dashboard: LayoutDashboard,
};

// ---- Access badge ----

function AccessBadge({ result }: { result: AccessResult }) {
  if (result.granted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" /> Allowed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="h-3 w-3" /> Denied
    </span>
  );
}

// ---- Resolution trace panel ----

function TracePanel({ result, label }: { result: AccessResult; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1"
      >
        <Info className="h-3 w-3" />
        {open ? 'Hide' : 'Show'} {label} trace
      </button>
      {open && (
        <div className="mt-1 ml-4 space-y-0.5">
          {result.trace.map((step, i) => (
            <div
              key={i}
              className={`text-[11px] flex items-start gap-1.5 ${
                step.granted ? 'text-emerald-400/70' : 'text-red-400/70'
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {step.granted ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              </span>
              <span>
                <span className="font-medium text-[var(--text-muted)]">[{step.source}]</span>{' '}
                {step.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Tree node row ----

function TreeRow({
  item,
  depth = 0,
  searchQuery,
}: {
  item: TreeAccessResult;
  depth?: number;
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = item.children.length > 0;
  const Icon = TYPE_ICONS[item.node.type] || CheckCircle2;

  // Filter by search
  const matchesSearch =
    !searchQuery ||
    item.node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.node.type.toLowerCase().includes(searchQuery.toLowerCase());

  const childMatchesSearch = useMemo(() => {
    if (!searchQuery) return true;
    function check(items: TreeAccessResult[]): boolean {
      return items.some(
        c =>
          c.node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          check(c.children),
      );
    }
    return check(item.children);
  }, [item.children, searchQuery]);

  if (!matchesSearch && !childMatchesSearch) return null;

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 px-3 hover:bg-white/[0.02] rounded-lg transition group ${
          depth === 0 ? 'mt-1' : ''
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-4 h-4 flex items-center justify-center shrink-0 ${
            hasChildren ? 'text-[var(--text-muted)]' : 'invisible'
          }`}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* Icon */}
        <Icon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-[var(--text-primary)] truncate">{item.node.name}</span>
          <span className="text-[11px] text-[var(--text-muted)] ml-2">{item.node.type}</span>
        </div>

        {/* Access badges */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1" title="Read">
            <Eye className="h-3 w-3 text-[var(--text-muted)]" />
            <AccessBadge result={item.read} />
          </div>
          <div className="flex items-center gap-1" title="Write">
            <Pencil className="h-3 w-3 text-[var(--text-muted)]" />
            <AccessBadge result={item.write} />
          </div>
          <div className="flex items-center gap-1" title="Delete">
            <Trash2 className="h-3 w-3 text-[var(--text-muted)]" />
            <AccessBadge result={item.delete} />
          </div>
        </div>
      </div>

      {/* Trace panels (only visible on hover / when relevant) */}
      {(!item.read.granted || !item.write.granted || !item.delete.granted) && (
        <div style={{ paddingLeft: `${32 + depth * 20}px` }} className="pb-1">
          {!item.read.granted && <TracePanel result={item.read} label="read" />}
          {item.read.granted && !item.write.granted && <TracePanel result={item.write} label="write" />}
          {!item.delete.granted && item.read.granted && <TracePanel result={item.delete} label="delete" />}
        </div>
      )}

      {/* Children */}
      {expanded &&
        hasChildren &&
        item.children.map(child => (
          <TreeRow key={child.node.id} item={child} depth={depth + 1} searchQuery={searchQuery} />
        ))}
    </>
  );
}

// ---- Main component ----

export default function PermissionInspector() {
  const { allMembers: members, teams, user } = useAuth();
  const { t } = useI18n();

  // State
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [whatIfRole, setWhatIfRole] = useState<Role | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Data
  const [orgMatrix, setOrgMatrix] = useState<any>(null);
  const [fieldRestrictions, setFieldRestrictions] = useState<FieldRestriction[]>([]);
  const [userOverrides, setUserOverrides] = useState<PermissionOverride[]>([]);
  const [scopedPermissions, setScopedPermissions] = useState<ScopedPermission[]>([]);

  // Results
  const [treeResults, setTreeResults] = useState<TreeAccessResult[]>([]);

  // Load org matrix + field restrictions on mount
  useEffect(() => {
    Promise.all([
      getSettings('permissions'),
      getFieldRestrictions(),
    ]).then(([permsSettings, fr]) => {
      if ((permsSettings as any)?.matrix) setOrgMatrix((permsSettings as any).matrix);
      setFieldRestrictions(fr);
    });
  }, []);

  // Build resource tree from teams/spaces data
  const resourceTree = useMemo((): ResourceNode[] => {
    return (teams || [])
      .filter((team: any) => team.status !== 'archived')
      .map((team: any) => ({
        id: team.id,
        type: 'space' as const,
        name: team.name || team.id,
        privacy: team.privacy || 'public',
        viewers: team.viewers || [],
        editors: team.editors || [],
        managers: team.managers || [],
        spaceId: team.id,
        children: [], // Children would be loaded per-space in a full implementation
      }));
  }, [teams]);

  // Load user permissions when selection changes
  const loadUserPerms = useCallback(async (userId: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const profile = await getUserPermissionProfile(userId);
      setUserOverrides(profile?.overrides || []);
      setScopedPermissions(profile?.scopedPermissions || []);
    } catch {
      setUserOverrides([]);
      setScopedPermissions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedUserId) loadUserPerms(selectedUserId);
  }, [selectedUserId, loadUserPerms]);

  // Build simulation context
  const selectedMember = useMemo(
    () => (members || []).find((m: any) => m.userId === selectedUserId),
    [members, selectedUserId],
  );

  const simulationCtx = useMemo((): SimulationContext | null => {
    if (!selectedMember) return null;
    const effectiveRole = (whatIfRole || selectedMember.role || 'member') as Role;
    return {
      userId: selectedMember.userId,
      role: effectiveRole,
      teamIds: selectedMember.teamIds || (selectedMember.teamId ? [selectedMember.teamId] : []),
      orgMatrix,
      userOverrides,
      scopedPermissions,
      fieldRestrictions,
    };
  }, [selectedMember, whatIfRole, orgMatrix, userOverrides, scopedPermissions, fieldRestrictions]);

  // Run simulation
  useEffect(() => {
    if (!simulationCtx || resourceTree.length === 0) {
      setTreeResults([]);
      return;
    }
    const results = simulateTree(simulationCtx, resourceTree);
    setTreeResults(results);
  }, [simulationCtx, resourceTree]);

  const summary = useMemo(() => summarizeTree(treeResults), [treeResults]);

  // Export to CSV
  const exportCSV = useCallback(() => {
    if (!treeResults.length || !selectedMember) return;

    const rows: string[] = ['Resource,Type,Read,Write,Delete,Read Reason,Write Reason,Delete Reason'];

    function walk(items: TreeAccessResult[], prefix = '') {
      for (const item of items) {
        const name = prefix ? `${prefix} > ${item.node.name}` : item.node.name;
        const readReason = item.read.trace[item.read.trace.length - 1]?.description || '';
        const writeReason = item.write.trace[item.write.trace.length - 1]?.description || '';
        const deleteReason = item.delete.trace[item.delete.trace.length - 1]?.description || '';
        rows.push(
          `"${name}","${item.node.type}",${item.read.granted},${item.write.granted},${item.delete.granted},"${readReason}","${writeReason}","${deleteReason}"`,
        );
        walk(item.children, name);
      }
    }
    walk(treeResults);

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permissions-${selectedMember.displayName || selectedMember.userId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [treeResults, selectedMember]);

  const ROLES: Role[] = ['owner', 'admin', 'manager', 'member', 'guest', 'readonly'];

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="h-5 w-5 text-[var(--accent)]" />
            Permission Inspector
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Simulate and visualize effective permissions for any user across all resources
          </p>
        </div>
        {treeResults.length > 0 && (
          <button
            onClick={exportCSV}
            className="px-4 h-9 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] flex items-center gap-2 border border-[var(--border)]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {/* User selector */}
        <div>
          <label className="text-[12px] uppercase text-[var(--text-muted)] font-semibold mb-1 block">
            Select User
          </label>
          <select
            value={selectedUserId}
            onChange={e => {
              setSelectedUserId(e.target.value);
              setWhatIfRole('');
            }}
            className="input-dark w-full"
          >
            <option value="">— Choose a member —</option>
            {(members || [])
              .filter((m: any) => m.active !== false)
              .sort((a: any, b: any) => (a.displayName || '').localeCompare(b.displayName || ''))
              .map((m: any) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName || m.email || m.userId} ({m.role})
                </option>
              ))}
          </select>
        </div>

        {/* What-if role */}
        <div>
          <label className="text-[12px] uppercase text-[var(--text-muted)] font-semibold mb-1 block">
            What-If Role
          </label>
          <select
            value={whatIfRole}
            onChange={e => setWhatIfRole(e.target.value as Role | '')}
            className="input-dark w-full"
            disabled={!selectedUserId}
          >
            <option value="">— Actual role —</option>
            {ROLES.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="text-[12px] uppercase text-[var(--text-muted)] font-semibold mb-1 block">
            Search Resources
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by name or type..."
              className="input-dark pl-10 w-full"
              disabled={!selectedUserId}
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {selectedUserId && selectedMember && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-[12px] uppercase text-[var(--text-muted)] font-semibold">User</span>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {selectedMember.displayName || selectedMember.email}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {whatIfRole ? (
                <span>
                  <span className="line-through">{selectedMember.role}</span>{' '}
                  <span className="text-amber-400">→ {whatIfRole}</span>
                </span>
              ) : (
                selectedMember.role
              )}
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-4 w-4 text-emerald-400" />
              <span className="text-[12px] uppercase text-[var(--text-muted)] font-semibold">Readable</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">{summary.readable}</p>
            <p className="text-[11px] text-[var(--text-muted)]">of {summary.total} resources</p>
          </div>

          <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Pencil className="h-4 w-4 text-blue-400" />
              <span className="text-[12px] uppercase text-[var(--text-muted)] font-semibold">Writable</span>
            </div>
            <p className="text-lg font-bold text-blue-400">{summary.writable}</p>
            <p className="text-[11px] text-[var(--text-muted)]">of {summary.total} resources</p>
          </div>

          <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="h-4 w-4 text-amber-400" />
              <span className="text-[12px] uppercase text-[var(--text-muted)] font-semibold">Deletable</span>
            </div>
            <p className="text-lg font-bold text-amber-400">{summary.deletable}</p>
            <p className="text-[11px] text-[var(--text-muted)]">of {summary.total} resources</p>
          </div>

          <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <EyeOff className="h-4 w-4 text-red-400" />
              <span className="text-[12px] uppercase text-[var(--text-muted)] font-semibold">Denied</span>
            </div>
            <p className="text-lg font-bold text-red-400">{summary.denied}</p>
            <p className="text-[11px] text-[var(--text-muted)]">cannot read</p>
          </div>
        </div>
      )}

      {/* What-if indicator */}
      {whatIfRole && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">
            Simulating as <strong>{whatIfRole}</strong> — this is a preview, not the actual role
          </span>
          <button
            onClick={() => setWhatIfRole('')}
            className="ml-auto text-[12px] text-amber-400 hover:text-amber-300 underline"
          >
            Reset
          </button>
        </div>
      )}

      {/* Resource tree */}
      {!selectedUserId ? (
        <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-12 text-center">
          <Shield className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">
            Select a user to inspect their effective permissions across all resources
          </p>
        </div>
      ) : loading ? (
        <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-12 text-center">
          <RefreshCw className="h-6 w-6 text-[var(--accent)] mx-auto mb-2 animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">Loading permissions...</p>
        </div>
      ) : treeResults.length === 0 ? (
        <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-12 text-center">
          <EyeOff className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No resources found to inspect</p>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <span className="flex-1 text-[12px] uppercase text-[var(--text-muted)] font-semibold">
              Resource
            </span>
            <div className="flex items-center gap-2 shrink-0 text-[12px] uppercase text-[var(--text-muted)] font-semibold">
              <span className="w-[72px] text-center flex items-center gap-1">
                <Eye className="h-3 w-3" /> Read
              </span>
              <span className="w-[72px] text-center flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Write
              </span>
              <span className="w-[72px] text-center flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> Delete
              </span>
            </div>
          </div>

          {/* Tree rows */}
          <div className="max-h-[60vh] overflow-y-auto">
            {treeResults.map(item => (
              <TreeRow key={item.node.id} item={item} searchQuery={searchQuery} />
            ))}
          </div>
        </div>
      )}

      {/* Field restrictions section */}
      {selectedUserId && simulationCtx && fieldRestrictions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--accent)]" />
            Field-Level Restrictions
          </h3>
          <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left px-4 py-2 text-[12px] uppercase text-[var(--text-muted)]">Resource</th>
                  <th className="text-left px-4 py-2 text-[12px] uppercase text-[var(--text-muted)]">Field</th>
                  <th className="text-left px-4 py-2 text-[12px] uppercase text-[var(--text-muted)]">Can Edit</th>
                  <th className="text-left px-4 py-2 text-[12px] uppercase text-[var(--text-muted)]">Reason</th>
                </tr>
              </thead>
              <tbody>
                {fieldRestrictions.map((fr, i) => {
                  const result = simulateFieldAccess(simulationCtx, fr.resource as any, fr.field);
                  return (
                    <tr key={i} className="border-b border-[var(--border)]/10">
                      <td className="px-4 py-2 text-[var(--text-secondary)] capitalize">{fr.resource}</td>
                      <td className="px-4 py-2 text-[var(--text-primary)] font-medium">{fr.field}</td>
                      <td className="px-4 py-2">
                        {result.canEdit ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" /> No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-[var(--text-muted)]">
                        {result.trace[0]?.description || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
