import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    doc: vi.fn().mockReturnThis(),
  },
}));

// Mock integrations-db
vi.mock('@/lib/integrations-db', () => ({
  getIntegrationByProvider: vi.fn(),
  updateIntegration: vi.fn().mockResolvedValue(undefined),
}));

// Mock integrations-crypto
vi.mock('@/lib/integrations-crypto', () => ({
  decryptToken: vi.fn((t: string) => `decrypted_${t}`),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { checkIntegrationHealth, checkAllIntegrationsHealth } from '../lib/integrations-health';
import { getIntegrationByProvider } from '../lib/integrations-db';

describe('Integration Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns disconnected when no integration found', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue(null);
    const result = await checkIntegrationHealth('slack');
    expect(result.provider).toBe('slack');
    expect(result.status).toBe('disconnected');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns error when no credentials found', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue({
      id: 'int-1',
      status: 'connected',
      config: {},
    });
    const result = await checkIntegrationHealth('slack');
    expect(result.status).toBe('error');
    expect(result.error).toBe('No credentials found');
  });

  it('returns connected for Slack when auth.test succeeds', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue({
      id: 'int-1',
      status: 'connected',
      oauthTokens: { accessToken: 'enc_token' },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const result = await checkIntegrationHealth('slack');
    expect(result.status).toBe('connected');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/auth.test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns connected for GitHub when user endpoint responds ok', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue({
      id: 'int-2',
      status: 'connected',
      oauthTokens: { accessToken: 'enc_gh_token' },
    });
    mockFetch.mockResolvedValue({ ok: true });

    const result = await checkIntegrationHealth('github');
    expect(result.status).toBe('connected');
  });

  it('returns error when Slack auth.test fails', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue({
      id: 'int-1',
      status: 'connected',
      oauthTokens: { accessToken: 'enc_token' },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
    });

    const result = await checkIntegrationHealth('slack');
    expect(result.status).toBe('error');
  });

  it('returns connected for unsupported provider with valid apiKey', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue({
      id: 'int-3',
      status: 'connected',
      config: { apiKey: 'my-api-key' },
    });

    const result = await checkIntegrationHealth('hubspot');
    expect(result.status).toBe('connected');
  });

  it('checkAllIntegrationsHealth checks multiple providers in parallel', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue(null);

    const results = await checkAllIntegrationsHealth(['slack', 'github', 'hubspot']);
    expect(results).toHaveLength(3);
    results.forEach(r => expect(r.status).toBe('disconnected'));
  });

  it('includes latencyMs in result', async () => {
    vi.mocked(getIntegrationByProvider).mockResolvedValue(null);
    const result = await checkIntegrationHealth('slack');
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
