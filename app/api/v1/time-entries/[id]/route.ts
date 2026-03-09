import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getTimeEntry, updateTimeEntry, deleteTimeEntry } from '@/lib/db-admin';
import { TimeEntryUpdateSchema, formatZodError } from '@/lib/validation';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'timeentries:read');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const entry = await getTimeEntry(id);
    if (!entry) return apiError('Time entry not found', 404);

    return apiResponse(entry);
  } catch {
    return apiError('Internal error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'timeentries:write');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const entry = await getTimeEntry(id);
    if (!entry) return apiError('Time entry not found', 404);

    const body = await req.json();
    const parsed = TimeEntryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(JSON.stringify(formatZodError(parsed.error)), 400);
    }
    const data = parsed.data;
    await updateTimeEntry(id, data);

    return apiResponse({ id, ...data });
  } catch {
    return apiError('Internal error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'timeentries:write');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const entry = await getTimeEntry(id);
    if (!entry) return apiError('Time entry not found', 404);

    await deleteTimeEntry(id);

    return apiResponse({ deleted: true, id });
  } catch {
    return apiError('Internal error', 500);
  }
}
