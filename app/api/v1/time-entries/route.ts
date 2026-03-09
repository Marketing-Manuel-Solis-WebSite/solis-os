import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { getTimeEntries, getTimeEntriesByDateRange, createTimeEntry } from '@/lib/db-admin';
import { TimeEntryCreateSchema, formatZodError } from '@/lib/validation';

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
  } catch {
    return apiError('Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'timeentries:write');
    if (!auth.valid) return auth.error!;

    const body = await req.json();
    const parsed = TimeEntryCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(JSON.stringify(formatZodError(parsed.error)), 400);
    }
    const data = parsed.data;

    const docRef = await createTimeEntry({
      ...data,
      createdBy: `api:${auth.context!.keyRecord.prefix}`,
    });

    return apiResponse({ id: docRef.id, ...data });
  } catch {
    return apiError('Internal error', 500);
  }
}
