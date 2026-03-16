// ================================================================
// Analytics Export API — CSV & PDF data export
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { exportData, type ExportEntity } from '@/lib/analytics-export';
import { exportDataAsPdf } from '@/lib/pdf-export';

const MANAGER_ROLES = ['manager', 'admin', 'owner'];

const VALID_ENTITIES: ExportEntity[] = ['tasks', 'time_entries', 'goals', 'activity_logs'];
const VALID_FORMATS = ['csv', 'pdf'] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

export async function GET(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify manager/admin role for data export
    const memberDoc = await adminDb.collection(`orgs/${ORG}/members`).doc(authedUser.uid).get();
    const role = memberDoc.exists ? (memberDoc.data()?.role as string) : null;
    if (!role || !MANAGER_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Manager role required for data export' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const entity = searchParams.get('entity') as ExportEntity;
    if (!entity || !VALID_ENTITIES.includes(entity)) {
      return NextResponse.json({ error: `Invalid entity. Must be one of: ${VALID_ENTITIES.join(', ')}` }, { status: 400 });
    }

    const format = (searchParams.get('format') || 'csv') as ExportFormat;
    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json({ error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` }, { status: 400 });
    }

    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const teamId = searchParams.get('teamId') || undefined;

    const result = await exportData({ entity, startDate, endDate, teamId });

    // PDF format — return styled HTML for print-to-PDF
    if (format === 'pdf') {
      const html = exportDataAsPdf({
        csv: result.csv,
        entity: result.entity,
        generatedAt: result.generatedAt,
      });
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Row-Count': String(result.rowCount),
        },
      });
    }

    // Default: CSV download
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${entity}_export_${result.generatedAt.split('T')[0]}.csv"`,
        'X-Row-Count': String(result.rowCount),
      },
    });
  } catch (err: any) {
    console.error('[Analytics Export] error:', err);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
