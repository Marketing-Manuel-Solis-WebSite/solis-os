import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { getTimeEntries, getTimeEntriesByDateRange, createTimeEntry } from '@/lib/db-admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'timeentries:read');
    if (!auth.valid) return auth.error!;

    const { limit, offset } = parsePagination(req);
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const userId = url.searchParams.get('userId');
    const teamId = url.searchParams.get('teamId');

    let entries: any[];

    if (startDate && endDate) {
      entries = await getTimeEntriesByDateRange(startDate, endDate, userId || undefined) as any[];
    } else {
      entries = await getTimeEntries(teamId || undefined) as any[];
    }

    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    return apiResponse(paginated, { total, limit, offset });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'timeentries:write');
    if (!auth.valid) return auth.error!;

    const body = await req.json();
    if (!body.userId || !body.date) return apiError('userId and date are required', 400);

    const docRef = await createTimeEntry({
      userId: body.userId,
      userName: body.userName || '',
      taskId: body.taskId || '',
      taskTitle: body.taskTitle || '',
      date: body.date,
      hours: body.hours || 0,
      minutes: body.minutes || 0,
      notes: body.notes || '',
      billable: body.billable ?? false,
      teamId: body.teamId || '',
      createdBy: `api:${auth.context!.keyRecord.prefix}`,
    });

    return apiResponse({ id: docRef.id, ...body });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}
