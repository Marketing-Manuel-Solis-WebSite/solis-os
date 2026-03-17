import { NextRequest, NextResponse } from 'next/server';
import { exportData, type ExportOptions } from '@/lib/analytics-export';
import { authenticateRequest } from '@/lib/server-auth';

/**
 * POST /api/export/pdf
 * Generates a PDF-ready HTML document for the given export entity.
 * Returns HTML that can be printed to PDF by the client or converted
 * by a headless renderer in production.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const options: ExportOptions = {
      entity: body.entity || 'tasks',
      startDate: body.startDate,
      endDate: body.endDate,
      teamId: body.teamId,
      columns: body.columns,
    };

    const result = await exportData(options);

    // exportDataAsPdf accepts the CSV result from analytics-export
    const html = (await import('@/lib/pdf-export')).exportDataAsPdf(result);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${options.entity}-report-${new Date().toISOString().slice(0, 10)}.html"`,
      },
    });
  } catch (err: any) {
    console.error('[PDF Export] Error:', err);
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}
