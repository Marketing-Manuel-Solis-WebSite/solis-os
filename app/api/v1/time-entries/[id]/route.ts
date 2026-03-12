import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getTimeEntry, updateTimeEntry, deleteTimeEntry } from '@/lib/db-admin';
import { afterTimeEntryUpdatedAdmin, afterTimeEntryDeletedAdmin } from '@/lib/timeentry-side-effects-admin';
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

    // Dispatch side effects — use first changed field as representative
    const changedField = Object.keys(data)[0] || 'hours';
    await afterTimeEntryUpdatedAdmin({
      entryId: id,
      entry: { ...(entry as any), ...data },
      field: changedField,
      from: (entry as any)?.[changedField],
      to: (data as any)[changedField],
      actor: { actorId: auth.context!.keyRecord.prefix, actorName: 'API' },
    });

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

    await afterTimeEntryDeletedAdmin({
      entryId: id,
      entry: entry as any,
      actor: { actorId: auth.context!.keyRecord.prefix, actorName: 'API' },
    });

    return apiResponse({ deleted: true, id });
  } catch {
    return apiError('Internal error', 500);
  }
}
