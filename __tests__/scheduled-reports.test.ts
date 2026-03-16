import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Admin — vi.mock is hoisted
const mockDocs = vi.fn().mockReturnValue([]);

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP') },
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(() => Promise.resolve({ docs: mockDocs() })),
      add: vi.fn().mockResolvedValue({ id: 'new-report-id' }),
    }),
    doc: vi.fn().mockReturnValue({
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('@/lib/analytics-export', () => ({
  exportData: vi.fn().mockResolvedValue({
    csv: 'id,title\n1,Test',
    rowCount: 1,
    entity: 'tasks',
    generatedAt: '2026-03-15T00:00:00.000Z',
  }),
}));

vi.mock('@/lib/pdf-export', () => ({
  exportDataAsPdf: vi.fn().mockReturnValue('<html><body>PDF</body></html>'),
}));

import { computeNextRunAt, processScheduledReports } from '../lib/scheduled-reports';

describe('Scheduled Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocs.mockReturnValue([]);
  });

  // ---- computeNextRunAt tests ----

  describe('computeNextRunAt', () => {
    it('computes next daily run as next day at 06:00 UTC', () => {
      const from = new Date('2026-03-15T10:00:00Z');
      const result = computeNextRunAt('daily', from);
      const d = new Date(result);

      expect(d.getUTCDate()).toBe(16);
      expect(d.getUTCMonth()).toBe(2); // March
      expect(d.getUTCHours()).toBe(6);
      expect(d.getUTCMinutes()).toBe(0);
    });

    it('computes next weekly run as next Monday at 06:00 UTC', () => {
      // 2026-03-15 is a Sunday (day 0)
      const from = new Date('2026-03-15T10:00:00Z');
      const result = computeNextRunAt('weekly', from);
      const d = new Date(result);

      expect(d.getUTCDay()).toBe(1); // Monday
      expect(d.getUTCDate()).toBe(16); // March 16, 2026
      expect(d.getUTCHours()).toBe(6);
    });

    it('computes next weekly run from a Wednesday', () => {
      // 2026-03-18 is a Wednesday (day 3)
      const from = new Date('2026-03-18T10:00:00Z');
      const result = computeNextRunAt('weekly', from);
      const d = new Date(result);

      expect(d.getUTCDay()).toBe(1); // Monday
      expect(d.getUTCDate()).toBe(23); // March 23, 2026
      expect(d.getUTCHours()).toBe(6);
    });

    it('computes next monthly run as first of next month at 06:00 UTC', () => {
      const from = new Date('2026-03-15T10:00:00Z');
      const result = computeNextRunAt('monthly', from);
      const d = new Date(result);

      expect(d.getUTCDate()).toBe(1);
      expect(d.getUTCMonth()).toBe(3); // April
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCHours()).toBe(6);
    });

    it('wraps year boundary for monthly from December', () => {
      const from = new Date('2026-12-15T10:00:00Z');
      const result = computeNextRunAt('monthly', from);
      const d = new Date(result);

      expect(d.getUTCDate()).toBe(1);
      expect(d.getUTCMonth()).toBe(0); // January
      expect(d.getUTCFullYear()).toBe(2027);
    });
  });

  // ---- processScheduledReports tests ----

  describe('processScheduledReports', () => {
    it('returns empty array when no reports are due', async () => {
      mockDocs.mockReturnValue([]);
      const results = await processScheduledReports();
      expect(results).toEqual([]);
    });

    it('processes a due CSV report', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockDocs.mockReturnValue([
        {
          id: 'report-1',
          ref: { update: vi.fn().mockResolvedValue(undefined) },
          data: () => ({
            id: 'report-1',
            orgId: 'solis-center',
            name: 'Weekly Tasks',
            entity: 'tasks',
            format: 'csv',
            frequency: 'weekly',
            recipients: ['test@example.com'],
            lastSentAt: null,
            nextRunAt: pastDate,
            active: true,
          }),
        },
      ]);

      const results = await processScheduledReports();

      expect(results).toHaveLength(1);
      expect(results[0].reportId).toBe('report-1');
      expect(results[0].entity).toBe('tasks');
      expect(results[0].format).toBe('csv');
      expect(results[0].recipients).toEqual(['test@example.com']);
      expect(results[0].rowCount).toBe(1);
      expect(results[0].content).toContain('id,title');
    });

    it('processes a due PDF report', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockDocs.mockReturnValue([
        {
          id: 'report-2',
          ref: { update: vi.fn().mockResolvedValue(undefined) },
          data: () => ({
            id: 'report-2',
            orgId: 'solis-center',
            name: 'Monthly Goals',
            entity: 'goals',
            format: 'pdf',
            frequency: 'monthly',
            recipients: ['admin@example.com'],
            lastSentAt: null,
            nextRunAt: pastDate,
            active: true,
          }),
        },
      ]);

      const results = await processScheduledReports();

      expect(results).toHaveLength(1);
      expect(results[0].format).toBe('pdf');
      expect(results[0].content).toContain('PDF');
    });

    it('does not process future reports', async () => {
      mockDocs.mockReturnValue([]);
      const results = await processScheduledReports();
      expect(results).toEqual([]);
    });
  });
});
