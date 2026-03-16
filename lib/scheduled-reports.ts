// ================================================================
// Scheduled Reports — periodic CSV/PDF exports
// ================================================================
// Allows users to schedule recurring exports of analytics data.
// Processed by a cron job that queries due reports and generates output.

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';
import { exportData, type ExportEntity } from '@/lib/analytics-export';
import { exportDataAsPdf } from '@/lib/pdf-export';

// ---- Types ----

export type ReportFrequency = 'daily' | 'weekly' | 'monthly';
export type ReportFormat = 'csv' | 'pdf';

export interface ScheduledReport {
  id: string;
  orgId: string;
  name: string;
  entity: ExportEntity;
  format: ReportFormat;
  frequency: ReportFrequency;
  recipients: string[]; // email addresses
  lastSentAt: string | null;
  nextRunAt: string; // ISO date string
  active: boolean;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ScheduledReportResult {
  reportId: string;
  entity: ExportEntity;
  format: ReportFormat;
  recipients: string[];
  rowCount: number;
  content: string; // CSV string or HTML string
}

// ---- Path helpers ----

const REPORTS_PATH = `orgs/${ORG}/scheduledReports`;

// ---- CRUD ----

export async function createScheduledReport(data: {
  name: string;
  entity: ExportEntity;
  format: ReportFormat;
  frequency: ReportFrequency;
  recipients: string[];
  createdBy?: string;
}): Promise<string> {
  const nextRunAt = computeNextRunAt(data.frequency, new Date());
  const ref = await adminDb.collection(REPORTS_PATH).add({
    orgId: ORG,
    name: data.name,
    entity: data.entity,
    format: data.format,
    frequency: data.frequency,
    recipients: data.recipients,
    lastSentAt: null,
    nextRunAt,
    active: true,
    createdBy: data.createdBy || '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getScheduledReports(): Promise<ScheduledReport[]> {
  const snap = await adminDb.collection(REPORTS_PATH)
    .where('orgId', '==', ORG)
    .get();

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  } as ScheduledReport));
}

export async function updateScheduledReport(
  id: string,
  data: Partial<Omit<ScheduledReport, 'id' | 'orgId'>>,
): Promise<void> {
  await adminDb.doc(`${REPORTS_PATH}/${id}`).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteScheduledReport(id: string): Promise<void> {
  await adminDb.doc(`${REPORTS_PATH}/${id}`).delete();
}

// ---- Processing ----

/**
 * Query reports that are due (nextRunAt <= now) and active.
 * Generate export for each, update lastSentAt and nextRunAt.
 * Returns results (actual email sending is handled externally).
 */
export async function processScheduledReports(): Promise<ScheduledReportResult[]> {
  const now = new Date().toISOString();
  const snap = await adminDb.collection(REPORTS_PATH)
    .where('orgId', '==', ORG)
    .where('active', '==', true)
    .where('nextRunAt', '<=', now)
    .get();

  const results: ScheduledReportResult[] = [];

  for (const doc of snap.docs) {
    const report = { id: doc.id, ...doc.data() } as ScheduledReport;

    try {
      // Generate export data
      const exportResult = await exportData({ entity: report.entity });

      let content: string;
      if (report.format === 'pdf') {
        content = exportDataAsPdf({
          csv: exportResult.csv,
          entity: exportResult.entity,
          generatedAt: exportResult.generatedAt,
        });
      } else {
        content = exportResult.csv;
      }

      results.push({
        reportId: report.id,
        entity: report.entity,
        format: report.format,
        recipients: report.recipients,
        rowCount: exportResult.rowCount,
        content,
      });

      // Update report with new timestamps
      const nextRunAt = computeNextRunAt(report.frequency, new Date());
      await adminDb.doc(`${REPORTS_PATH}/${report.id}`).update({
        lastSentAt: now,
        nextRunAt,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error(`[ScheduledReports] Failed to process report ${report.id}:`, err);
    }
  }

  return results;
}

// ---- Date helpers ----

/**
 * Compute the next run date based on frequency.
 * - daily: next day at 06:00 UTC
 * - weekly: next Monday at 06:00 UTC
 * - monthly: first of next month at 06:00 UTC
 */
export function computeNextRunAt(frequency: ReportFrequency, fromDate: Date): string {
  const d = new Date(fromDate);

  switch (frequency) {
    case 'daily': {
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(6, 0, 0, 0);
      return d.toISOString();
    }
    case 'weekly': {
      // Next Monday
      const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ...
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
      d.setUTCDate(d.getUTCDate() + daysUntilMonday);
      d.setUTCHours(6, 0, 0, 0);
      return d.toISOString();
    }
    case 'monthly': {
      // First of next month
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
      d.setUTCHours(6, 0, 0, 0);
      return d.toISOString();
    }
    default:
      return d.toISOString();
  }
}
