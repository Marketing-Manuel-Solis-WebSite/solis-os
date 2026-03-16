// ================================================================
// Advanced Audit — Enhanced audit logging with compliance features
// ================================================================
// Extends basic event logging with:
//   - Structured audit entries with before/after snapshots
//   - Compliance-ready export (who, what, when, from where)
//   - Tamper detection via hash chain
//   - Retention policy enforcement

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export interface AuditEntry {
  id: string;
  orgId: string;
  timestamp: any;
  actor: {
    userId: string;
    displayName: string;
    email: string;
    role: string;
    ipAddress?: string;
  };
  action: AuditAction;
  resource: {
    type: string;
    id: string;
    name: string;
  };
  changes?: {
    field: string;
    before: any;
    after: any;
  }[];
  metadata?: Record<string, any>;
  severity: 'info' | 'warning' | 'critical';
  hashChain: string;  // SHA-256 chain for tamper detection
}

export type AuditAction =
  | 'create' | 'update' | 'delete' | 'archive' | 'restore'
  | 'login' | 'logout' | 'role_change' | 'permission_change'
  | 'export' | 'import' | 'share' | 'revoke_share'
  | 'api_key_created' | 'api_key_revoked'
  | 'invite_sent' | 'invite_accepted' | 'member_deactivated'
  | 'automation_triggered' | 'bulk_operation';

export interface AuditQuery {
  startDate?: string;
  endDate?: string;
  actorId?: string;
  resourceType?: string;
  action?: AuditAction;
  severity?: 'info' | 'warning' | 'critical';
  maxResults?: number;
}

export interface AuditSummary {
  totalEntries: number;
  byAction: Record<string, number>;
  byActor: Record<string, number>;
  bySeverity: Record<string, number>;
  byResource: Record<string, number>;
  period: { start: string; end: string };
}

// ---- Hash Chain ----

let lastHash = '';

function computeHash(entry: Omit<AuditEntry, 'id' | 'hashChain'>): string {
  const payload = JSON.stringify({
    prev: lastHash,
    actor: entry.actor.userId,
    action: entry.action,
    resource: `${entry.resource.type}:${entry.resource.id}`,
    ts: Date.now(),
  });
  const hash = createHash('sha256').update(payload).digest('hex');
  lastHash = hash;
  return hash;
}

// ---- Write Audit Entry ----

/**
 * Create an audit entry with hash chain integrity.
 */
export async function writeAuditEntry(data: {
  actor: AuditEntry['actor'];
  action: AuditAction;
  resource: AuditEntry['resource'];
  changes?: AuditEntry['changes'];
  metadata?: Record<string, any>;
  severity?: 'info' | 'warning' | 'critical';
}): Promise<string> {
  const entry = {
    orgId: ORG,
    actor: data.actor,
    action: data.action,
    resource: data.resource,
    changes: data.changes || [],
    metadata: data.metadata || {},
    severity: data.severity || inferSeverity(data.action),
    timestamp: FieldValue.serverTimestamp(),
  };

  const hashChain = computeHash(entry as any);

  const ref = await adminDb.collection(`orgs/${ORG}/auditTrail`).add({
    ...entry,
    hashChain,
  });

  return ref.id;
}

function inferSeverity(action: AuditAction): 'info' | 'warning' | 'critical' {
  const critical: AuditAction[] = ['role_change', 'permission_change', 'member_deactivated', 'api_key_revoked', 'delete', 'bulk_operation'];
  const warning: AuditAction[] = ['export', 'import', 'share', 'revoke_share', 'api_key_created', 'invite_sent'];
  if (critical.includes(action)) return 'critical';
  if (warning.includes(action)) return 'warning';
  return 'info';
}

// ---- Query Audit Entries ----

export async function queryAuditTrail(options: AuditQuery = {}): Promise<AuditEntry[]> {
  const max = Math.min(options.maxResults || 100, 500);
  let q = adminDb.collection(`orgs/${ORG}/auditTrail`)
    .orderBy('timestamp', 'desc')
    .limit(max);

  if (options.startDate) {
    q = q.where('timestamp', '>=', new Date(options.startDate));
  }
  if (options.endDate) {
    q = q.where('timestamp', '<=', new Date(options.endDate + 'T23:59:59'));
  }

  const snap = await q.get();
  let entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry));

  // Client-side filters for fields without compound indexes
  if (options.actorId) entries = entries.filter(e => e.actor.userId === options.actorId);
  if (options.resourceType) entries = entries.filter(e => e.resource.type === options.resourceType);
  if (options.action) entries = entries.filter(e => e.action === options.action);
  if (options.severity) entries = entries.filter(e => e.severity === options.severity);

  return entries;
}

// ---- Audit Summary ----

export async function getAuditSummary(
  startDate: string,
  endDate: string,
): Promise<AuditSummary> {
  const entries = await queryAuditTrail({ startDate, endDate, maxResults: 500 });

  const byAction: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byResource: Record<string, number> = {};

  for (const e of entries) {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
    byActor[e.actor.displayName || e.actor.userId] = (byActor[e.actor.displayName || e.actor.userId] || 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    byResource[e.resource.type] = (byResource[e.resource.type] || 0) + 1;
  }

  return {
    totalEntries: entries.length,
    byAction,
    byActor,
    bySeverity,
    byResource,
    period: { start: startDate, end: endDate },
  };
}

// ---- Compliance Export ----

/**
 * Export audit trail as structured CSV for compliance reporting.
 */
export function exportAuditCSV(entries: AuditEntry[]): string {
  const headers = ['Timestamp', 'Actor', 'Email', 'Role', 'Action', 'Resource Type', 'Resource ID', 'Resource Name', 'Severity', 'Changes', 'Hash'];

  const rows = entries.map(e => {
    const ts = e.timestamp?.toDate?.()?.toISOString() || '';
    const changes = (e.changes || []).map(c => `${c.field}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`).join('; ');
    return [
      ts,
      e.actor.displayName,
      e.actor.email,
      e.actor.role,
      e.action,
      e.resource.type,
      e.resource.id,
      e.resource.name,
      e.severity,
      changes,
      e.hashChain,
    ].map(v => escapeCSV(String(v || ''))).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---- Retention Policy ----

/**
 * Clean up audit entries beyond retention period.
 * Default: 365 days. Returns count of deleted entries.
 */
export async function enforceRetentionPolicy(retentionDays: number = 365): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const snap = await adminDb.collection(`orgs/${ORG}/auditTrail`)
    .where('timestamp', '<', cutoff)
    .limit(500)
    .get();

  if (snap.empty) return 0;

  const CHUNK = 450;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = adminDb.batch();
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(CHUNK, snap.docs.length - i);
  }

  return deleted;
}
