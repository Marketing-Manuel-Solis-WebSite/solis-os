// ================================================================
// Platform Health — System monitoring & diagnostics
// ================================================================
// Checks health of all platform subsystems: Firestore, API routes,
// cron jobs, integrations, and resource usage.

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface SubsystemHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  message: string;
  lastChecked: string;
  details?: Record<string, any>;
}

export interface PlatformHealthReport {
  overall: HealthStatus;
  subsystems: SubsystemHealth[];
  resourceUsage: ResourceUsage;
  cronStatus: CronJobStatus[];
  generatedAt: string;
}

export interface ResourceUsage {
  firestoreReads: number;      // estimated from recent activity
  firestoreWrites: number;
  activeUsers: number;
  totalDocuments: number;
  storageEstimateMB: number;
}

export interface CronJobStatus {
  name: string;
  lastRunAt: string | null;
  lastStatus: 'success' | 'error' | 'unknown';
  frequency: string;
  nextExpectedRun: string;
}

// ---- Health Checks ----

/**
 * Run comprehensive platform health check.
 */
export async function checkPlatformHealth(): Promise<PlatformHealthReport> {
  const start = Date.now();
  const subsystems: SubsystemHealth[] = [];

  // 1. Firestore connectivity
  subsystems.push(await checkFirestore());

  // 2. Member data integrity
  subsystems.push(await checkMemberData());

  // 3. Recent event log activity
  subsystems.push(await checkEventLogActivity());

  // 4. Webhook delivery health
  subsystems.push(await checkWebhookHealth());

  // 5. AI service availability
  subsystems.push(await checkAIService());

  // Resource usage estimation
  const resourceUsage = await estimateResourceUsage();

  // Cron job status
  const cronStatus = await getCronJobStatuses();

  // Overall status
  const statuses = subsystems.map(s => s.status);
  let overall: HealthStatus = 'healthy';
  if (statuses.includes('unhealthy')) overall = 'unhealthy';
  else if (statuses.includes('degraded')) overall = 'degraded';

  return {
    overall,
    subsystems,
    resourceUsage,
    cronStatus,
    generatedAt: new Date().toISOString(),
  };
}

// ---- Individual Checks ----

async function checkFirestore(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    // Simple read to verify Firestore connectivity
    await adminDb.doc(`orgs/${ORG}`).get();
    return {
      name: 'Firestore',
      status: 'healthy',
      latencyMs: Date.now() - start,
      message: 'Connected and responsive',
      lastChecked: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      name: 'Firestore',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err?.message || 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkMemberData(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    const snap = await adminDb.collection(`orgs/${ORG}/members`).get();
    const members = snap.docs.map(d => d.data());
    const active = members.filter(m => m.active !== false);
    const withoutRole = members.filter(m => !m.role);
    const withoutTeam = active.filter(m => !m.teamId);

    const issues: string[] = [];
    if (withoutRole.length > 0) issues.push(`${withoutRole.length} members without role`);
    if (withoutTeam.length > 0) issues.push(`${withoutTeam.length} active members without team`);

    return {
      name: 'Member Data',
      status: issues.length > 0 ? 'degraded' : 'healthy',
      latencyMs: Date.now() - start,
      message: issues.length > 0 ? issues.join('; ') : `${active.length} active members, all valid`,
      lastChecked: new Date().toISOString(),
      details: { total: members.length, active: active.length, issues },
    };
  } catch (err: any) {
    return {
      name: 'Member Data',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err?.message || 'Failed to query members',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkEventLogActivity(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    const oneDayAgo = new Date(Date.now() - 86_400_000);
    const snap = await adminDb.collection(`orgs/${ORG}/eventLogs`)
      .where('createdAt', '>=', oneDayAgo)
      .limit(1)
      .get();

    const hasRecentActivity = !snap.empty;
    return {
      name: 'Event Logging',
      status: hasRecentActivity ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      message: hasRecentActivity ? 'Events logged in last 24h' : 'No events in last 24h — check if logging is working',
      lastChecked: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      name: 'Event Logging',
      status: 'unknown',
      latencyMs: Date.now() - start,
      message: err?.message || 'Could not check event logs',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkWebhookHealth(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    const snap = await adminDb.collection('webhookEvents')
      .where('orgId', '==', ORG)
      .where('processed', '==', false)
      .limit(50)
      .get();

    const pendingCount = snap.size;
    let status: HealthStatus = 'healthy';
    let message = 'No pending webhook events';

    if (pendingCount > 20) {
      status = 'degraded';
      message = `${pendingCount} webhook events pending — delivery may be backed up`;
    } else if (pendingCount > 0) {
      message = `${pendingCount} webhook events pending (normal)`;
    }

    return {
      name: 'Webhook Delivery',
      status,
      latencyMs: Date.now() - start,
      message,
      lastChecked: new Date().toISOString(),
      details: { pendingEvents: pendingCount },
    };
  } catch (err: any) {
    return {
      name: 'Webhook Delivery',
      status: 'unknown',
      latencyMs: Date.now() - start,
      message: err?.message || 'Could not check webhook events',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkAIService(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    // Check if AI usage tracking is working (doesn't call Gemini API)
    const dayKey = new Date().toISOString().split('T')[0];
    await adminDb.collection(`orgs/${ORG}/ai-usage`).limit(1).get();

    return {
      name: 'AI Service',
      status: 'healthy',
      latencyMs: Date.now() - start,
      message: 'Usage tracking accessible',
      lastChecked: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      name: 'AI Service',
      status: 'degraded',
      latencyMs: Date.now() - start,
      message: err?.message || 'Could not verify AI service',
      lastChecked: new Date().toISOString(),
    };
  }
}

// ---- Resource Usage ----

async function estimateResourceUsage(): Promise<ResourceUsage> {
  try {
    const [membersSnap, tasksSnap, docsSnap] = await Promise.all([
      adminDb.collection(`orgs/${ORG}/members`).get(),
      adminDb.collection('tasks').where('orgId', '==', ORG).limit(1).get(),
      adminDb.collection('documents').where('orgId', '==', ORG).limit(1).get(),
    ]);

    const activeUsers = membersSnap.docs.filter(d => d.data().active !== false).length;

    // Rough estimates — exact counts would require count aggregations
    return {
      firestoreReads: 0,   // Would need billing API
      firestoreWrites: 0,  // Would need billing API
      activeUsers,
      totalDocuments: 0,    // Placeholder — exact count is expensive
      storageEstimateMB: 0, // Would need Storage API
    };
  } catch {
    return { firestoreReads: 0, firestoreWrites: 0, activeUsers: 0, totalDocuments: 0, storageEstimateMB: 0 };
  }
}

// ---- Cron Job Status ----

async function getCronJobStatuses(): Promise<CronJobStatus[]> {
  const jobs: CronJobStatus[] = [
    { name: 'process-deadlines', lastRunAt: null, lastStatus: 'unknown', frequency: 'Daily 8:00 AM', nextExpectedRun: '' },
    { name: 'process-webhooks', lastRunAt: null, lastStatus: 'unknown', frequency: 'Every 5 minutes', nextExpectedRun: '' },
    { name: 'analytics-snapshot', lastRunAt: null, lastStatus: 'unknown', frequency: 'Daily 6:00 AM UTC', nextExpectedRun: '' },
    { name: 'housekeeping', lastRunAt: null, lastStatus: 'unknown', frequency: 'Daily 3:00 AM UTC', nextExpectedRun: '' },
  ];

  // Check analytics snapshots to infer last run
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

    const snap = await adminDb.doc(`orgs/${ORG}/analyticsSnapshots/${today}`).get();
    if (snap.exists) {
      const snapshotJob = jobs.find(j => j.name === 'analytics-snapshot');
      if (snapshotJob) {
        snapshotJob.lastRunAt = snap.data()?.computedAt || today;
        snapshotJob.lastStatus = 'success';
      }
    }
  } catch { /* ignore */ }

  return jobs;
}
