import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockAdd, mockBatchDelete, mockBatchCommit, mockDocGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockAdd: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue(undefined),
  mockDocGet: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: mockGet,
      add: mockAdd,
    })),
    doc: vi.fn(() => ({
      get: mockDocGet,
    })),
    batch: vi.fn(() => ({
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    })),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  },
}));

import {
  writeAuditEntry,
  queryAuditTrail,
  getAuditSummary,
  exportAuditCSV,
  enforceRetentionPolicy,
} from '@/lib/advanced-audit';
import type { AuditEntry } from '@/lib/advanced-audit';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- writeAuditEntry ----

describe('writeAuditEntry', () => {
  it('writes an audit entry and returns its ID', async () => {
    mockAdd.mockResolvedValue({ id: 'audit-123' });

    const id = await writeAuditEntry({
      actor: { userId: 'u1', displayName: 'Alice', email: 'a@b.com', role: 'admin' },
      action: 'create',
      resource: { type: 'task', id: 't1', name: 'Test Task' },
    });

    expect(id).toBe('audit-123');
    expect(mockAdd).toHaveBeenCalledOnce();
  });

  it('auto-infers severity as critical for role_change', async () => {
    mockAdd.mockResolvedValue({ id: 'audit-456' });

    await writeAuditEntry({
      actor: { userId: 'u1', displayName: 'Admin', email: 'a@b.com', role: 'admin' },
      action: 'role_change',
      resource: { type: 'member', id: 'm1', name: 'Bob' },
    });

    const calledWith = mockAdd.mock.calls[0][0];
    expect(calledWith.severity).toBe('critical');
  });

  it('includes hash chain in written entry', async () => {
    mockAdd.mockResolvedValue({ id: 'audit-789' });

    await writeAuditEntry({
      actor: { userId: 'u1', displayName: 'Admin', email: 'a@b.com', role: 'admin' },
      action: 'create',
      resource: { type: 'task', id: 't2', name: 'Another Task' },
    });

    const calledWith = mockAdd.mock.calls[0][0];
    expect(calledWith.hashChain).toBeTruthy();
    expect(typeof calledWith.hashChain).toBe('string');
    expect(calledWith.hashChain.length).toBe(64); // SHA-256 hex
  });
});

// ---- queryAuditTrail ----

describe('queryAuditTrail', () => {
  it('returns mapped audit entries', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: 'a1', data: () => ({ action: 'create', actor: { userId: 'u1' }, resource: { type: 'task' }, severity: 'info' }) },
        { id: 'a2', data: () => ({ action: 'delete', actor: { userId: 'u2' }, resource: { type: 'doc' }, severity: 'critical' }) },
      ],
    });

    const entries = await queryAuditTrail();
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('a1');
    expect(entries[1].action).toBe('delete');
  });

  it('filters by actorId client-side', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: 'a1', data: () => ({ action: 'create', actor: { userId: 'u1' }, resource: { type: 'task' }, severity: 'info' }) },
        { id: 'a2', data: () => ({ action: 'create', actor: { userId: 'u2' }, resource: { type: 'task' }, severity: 'info' }) },
      ],
    });

    const entries = await queryAuditTrail({ actorId: 'u1' });
    expect(entries).toHaveLength(1);
    expect(entries[0].actor.userId).toBe('u1');
  });
});

// ---- exportAuditCSV ----

describe('exportAuditCSV', () => {
  it('generates CSV with headers and rows', () => {
    const entries: AuditEntry[] = [
      {
        id: 'a1',
        orgId: 'solis-center',
        timestamp: { toDate: () => new Date('2025-01-15T10:00:00Z') },
        actor: { userId: 'u1', displayName: 'Alice', email: 'alice@test.com', role: 'admin' },
        action: 'create',
        resource: { type: 'task', id: 't1', name: 'My Task' },
        changes: [{ field: 'status', before: 'todo', after: 'done' }],
        severity: 'info',
        hashChain: 'abc123',
      },
    ];

    const csv = exportAuditCSV(entries);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Timestamp');
    expect(lines[0]).toContain('Actor');
    expect(lines[0]).toContain('Hash');
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('abc123');
  });

  it('escapes CSV values with commas', () => {
    const entries: AuditEntry[] = [
      {
        id: 'a2',
        orgId: 'solis-center',
        timestamp: { toDate: () => new Date('2025-01-15T10:00:00Z') },
        actor: { userId: 'u1', displayName: 'Bob, Jr.', email: 'bob@test.com', role: 'member' },
        action: 'update',
        resource: { type: 'doc', id: 'd1', name: 'Doc, with comma' },
        severity: 'warning',
        hashChain: 'def456',
      },
    ];

    const csv = exportAuditCSV(entries);
    expect(csv).toContain('"Bob, Jr."');
  });

  it('returns only headers for empty entries', () => {
    const csv = exportAuditCSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Timestamp');
  });
});

// ---- enforceRetentionPolicy ----

describe('enforceRetentionPolicy', () => {
  it('returns 0 when no expired entries', async () => {
    mockGet.mockResolvedValue({ empty: true, docs: [] });
    const count = await enforceRetentionPolicy(365);
    expect(count).toBe(0);
  });

  it('deletes expired entries in batches', async () => {
    const mockDocs = Array.from({ length: 5 }, (_, i) => ({
      ref: { id: `doc-${i}` },
    }));
    mockGet.mockResolvedValue({ empty: false, docs: mockDocs });

    const count = await enforceRetentionPolicy(365);
    expect(count).toBe(5);
    expect(mockBatchDelete).toHaveBeenCalledTimes(5);
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });
});
