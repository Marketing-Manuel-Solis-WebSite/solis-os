import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { createGoal, countByOrg, queryGoalsPaginated } from '@/lib/db-admin';
import { GoalCreateSchema, formatZodError } from '@/lib/validation';
import { afterGoalCreatedAdmin } from '@/lib/goal-side-effects-admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'goals:read');
    if (!auth.valid) return auth.error!;

    const { limit, cursor } = parsePagination(req);
    const url = new URL(req.url);
    const teamId = url.searchParams.get('teamId');
    const status = url.searchParams.get('status');

    // Firestore-native cursor pagination with pushed filters
    const [result, total] = await Promise.all([
      queryGoalsPaginated({ limit, cursor, status, teamId }),
      countByOrg('goals'),
    ]);

    return apiResponse(result.items, { total, limit, hasMore: result.hasMore, nextCursor: result.nextCursor });
  } catch {
    return apiError('Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'goals:write');
    if (!auth.valid) return auth.error!;

    const body = await req.json();
    const parsed = GoalCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(JSON.stringify(formatZodError(parsed.error)), 400);
    }
    const data = parsed.data;

    const docRef = await createGoal({
      ...data,
      createdBy: `api:${auth.context!.keyRecord.prefix}`,
      createdByName: 'API',
    });

    const apiActor = `api:${auth.context!.keyRecord.prefix}`;
    await afterGoalCreatedAdmin({
      goalId: docRef.id,
      goal: data,
      actor: { actorId: apiActor, actorName: apiActor },
    });

    return apiResponse({ id: docRef.id, ...data });
  } catch {
    return apiError('Internal error', 500);
  }
}
