import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCollectionGet, mockDocGet } = vi.hoisted(() => ({
  mockCollectionGet: vi.fn(),
  mockDocGet: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    doc: vi.fn(() => ({
      get: mockDocGet,
    })),
    collection: vi.fn(() => ({
      get: mockCollectionGet,
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    })),
  },
}));

import { checkPlatformHealth } from '@/lib/platform-health';
import type { PlatformHealthReport, HealthStatus } from '@/lib/platform-health';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all checks succeed
  mockDocGet.mockResolvedValue({ exists: () => true, data: () => ({ computedAt: '2025-01-15' }) });
  mockCollectionGet.mockResolvedValue({
    docs: [{ data: () => ({ active: true, role: 'member', teamId: 't1' }) }],
    size: 0,
    empty: false,
  });
});

describe('checkPlatformHealth', () => {
  it('returns a valid health report structure', async () => {
    const report = await checkPlatformHealth();
    expect(report).toHaveProperty('overall');
    expect(report).toHaveProperty('subsystems');
    expect(report).toHaveProperty('resourceUsage');
    expect(report).toHaveProperty('cronStatus');
    expect(report).toHaveProperty('generatedAt');
  });

  it('checks all 5 subsystems', async () => {
    const report = await checkPlatformHealth();
    expect(report.subsystems).toHaveLength(5);
    const names = report.subsystems.map(s => s.name);
    expect(names).toContain('Firestore');
    expect(names).toContain('Member Data');
    expect(names).toContain('Event Logging');
    expect(names).toContain('Webhook Delivery');
    expect(names).toContain('AI Service');
  });

  it('each subsystem has required fields', async () => {
    const report = await checkPlatformHealth();
    for (const sub of report.subsystems) {
      expect(sub.name).toBeTruthy();
      expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(sub.status);
      expect(typeof sub.latencyMs).toBe('number');
      expect(sub.message).toBeTruthy();
      expect(sub.lastChecked).toBeTruthy();
    }
  });

  it('reports healthy when all checks pass', async () => {
    const report = await checkPlatformHealth();
    expect(report.overall).toBe('healthy');
  });

  it('reports unhealthy when Firestore fails', async () => {
    mockDocGet.mockRejectedValueOnce(new Error('Connection refused'));
    const report = await checkPlatformHealth();
    const firestore = report.subsystems.find(s => s.name === 'Firestore');
    expect(firestore?.status).toBe('unhealthy');
    expect(report.overall).toBe('unhealthy');
  });

  it('reports degraded for member data issues', async () => {
    // First call: Firestore check (doc get) - OK
    mockDocGet
      .mockResolvedValueOnce({ exists: () => true, data: () => ({}) })  // firestore check
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ computedAt: '2025-01-15' }) });  // analytics snapshot

    // Member data: members without role
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ active: true, teamId: 't1' }) },  // no role
        ],
        size: 0,
        empty: false,
      })
      .mockResolvedValueOnce({ docs: [], size: 0, empty: false }) // event logs
      .mockResolvedValueOnce({ docs: [], size: 0, empty: true }) // webhook events
      .mockResolvedValueOnce({ docs: [], size: 0, empty: true }) // AI usage
      .mockResolvedValueOnce({ docs: [{ data: () => ({ active: true }) }], size: 1, empty: false }) // resource: members
      .mockResolvedValueOnce({ docs: [], size: 0, empty: true }) // resource: tasks
      .mockResolvedValueOnce({ docs: [], size: 0, empty: true }); // resource: documents

    const report = await checkPlatformHealth();
    const memberData = report.subsystems.find(s => s.name === 'Member Data');
    expect(memberData?.status).toBe('degraded');
  });

  it('includes cron job statuses', async () => {
    const report = await checkPlatformHealth();
    expect(report.cronStatus.length).toBeGreaterThan(0);
    const names = report.cronStatus.map(c => c.name);
    expect(names).toContain('process-deadlines');
    expect(names).toContain('analytics-snapshot');
  });

  it('includes resource usage estimation', async () => {
    const report = await checkPlatformHealth();
    expect(report.resourceUsage).toHaveProperty('activeUsers');
    expect(report.resourceUsage).toHaveProperty('firestoreReads');
    expect(typeof report.resourceUsage.activeUsers).toBe('number');
  });

  it('reports generatedAt as ISO timestamp', async () => {
    const report = await checkPlatformHealth();
    expect(() => new Date(report.generatedAt)).not.toThrow();
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
