import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getGoal, updateGoal, deleteGoal } from '@/lib/db';
import { queueEvent } from '@/lib/integrations-db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'goals:read');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const goal = await getGoal(id);
    if (!goal) return apiError('Goal not found', 404);

    return apiResponse(goal);
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'goals:write');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const goal = await getGoal(id);
    if (!goal) return apiError('Goal not found', 404);

    const body = await req.json();
    await updateGoal(id, body);

    const eventType = body.progress !== undefined ? 'goal.progress_changed' : 'goal.updated';
    queueEvent({
      eventType,
      entityId: id,
      entityType: 'goal',
      payload: { changes: Object.keys(body) },
    }).catch(() => {});

    return apiResponse({ id, ...body });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'goals:write');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const goal = await getGoal(id);
    if (!goal) return apiError('Goal not found', 404);

    await deleteGoal(id);

    return apiResponse({ deleted: true, id });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}
