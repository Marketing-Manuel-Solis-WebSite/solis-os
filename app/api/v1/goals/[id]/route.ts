import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getGoal, updateGoal, deleteGoal } from '@/lib/db-admin';
import { GoalUpdateSchema, formatZodError } from '@/lib/validation';
import { afterGoalUpdatedAdmin, afterGoalDeletedAdmin } from '@/lib/goal-side-effects-admin';

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

    const apiActor = `api:${auth.context!.keyRecord.prefix}`;
    for (const field of Object.keys(data)) {
      await afterGoalUpdatedAdmin({
        goalId: id,
        goal: goal as Record<string, any>,
        field,
        from: (goal as any)[field],
        to: (data as any)[field],
        actor: { actorId: apiActor, actorName: apiActor },
      });
    }

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

    const apiActorDel = `api:${auth.context!.keyRecord.prefix}`;
    await afterGoalDeletedAdmin({
      goalId: id,
      goal: goal as Record<string, any>,
      actor: { actorId: apiActorDel, actorName: apiActorDel },
    });

    return apiResponse({ deleted: true, id });
  } catch {
    return apiError('Internal error', 500);
  }
}
