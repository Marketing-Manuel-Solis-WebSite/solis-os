import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getTimeEntry, updateTimeEntry, deleteTimeEntry } from '@/lib/db-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'timeentries:read');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const entry = await getTimeEntry(id);
    if (!entry) return apiError('Time entry not found', 404);

    return apiResponse(entry);
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
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
    await updateTimeEntry(id, body);

    return apiResponse({ id, ...body });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
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
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}
