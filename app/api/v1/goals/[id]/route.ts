import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getGoal, updateGoal, deleteGoal } from '@/lib/db-admin';
import { queueEvent } from '@/lib/integrations-db-admin';
import { GoalUpdateSchema, formatZodError } from '@/lib/validation';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'goals:read');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const goal = await getGoal(id);
    if (!goal) return apiError('Goal not found', 404);

    return apiResponse(goal);
  } catch {
    return apiError('Internal error', 500);
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
    const parsed = GoalUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(JSON.stringify(formatZodError(parsed.error)), 400);
    }
    const data = parsed.data;
    await updateGoal(id, data);

    const eventType = data.progress !== undefined ? 'goal.progress_changed' : 'goal.updated';
    queueEvent({
      eventType,
      entityId: id,
      entityType: 'goal',
      payload: { changes: Object.keys(data) },
    }).catch(() => {});

    return apiResponse({ id, ...data });
  } catch {
    return apiError('Internal error', 500);
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
  } catch {
    return apiError('Internal error', 500);
  }
}
