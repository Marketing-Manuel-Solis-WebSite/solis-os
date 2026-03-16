// ================================================================
// Cron: Scheduled Reports — process due recurring exports
// ================================================================
// Runs on a schedule (e.g. daily at 06:30 UTC). Processes all
// scheduled reports that are due, generates CSV/PDF, returns results.
// Actual email delivery can be wired separately.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { processScheduledReports } = await import('@/lib/scheduled-reports');
    const results = await processScheduledReports();

    return NextResponse.json({
      ok: true,
      processed: results.length,
      reports: results.map(r => ({
        reportId: r.reportId,
        entity: r.entity,
        format: r.format,
        recipients: r.recipients,
        rowCount: r.rowCount,
      })),
    });
  } catch (err: any) {
    console.error('[Cron:ScheduledReports] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error processing scheduled reports' }, { status: 500 });
  }
}
