import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { getGoals, createGoal } from '@/lib/db-admin';
import { queueEvent } from '@/lib/integrations-db-admin';
import { GoalCreateSchema, formatZodError } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'goals:read');
    if (!auth.valid) return auth.error!;

    const { limit, offset } = parsePagination(req);
    const url = new URL(req.url);
    const teamId = url.searchParams.get('teamId');
    const status = url.searchParams.get('status');

    let goals = await getGoals(teamId || undefined) as any[];

    if (status) goals = goals.filter((g: any) => g.status === status);

    const total = goals.length;
    const paginated = goals.slice(offset, offset + limit);

    return apiResponse(paginated, { total, limit, offset });
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

    queueEvent({
      eventType: 'goal.created',
      entityId: docRef.id,
      entityType: 'goal',
      payload: { name: data.name },
    }).catch(() => {});

    return apiResponse({ id: docRef.id, ...data });
  } catch {
    return apiError('Internal error', 500);
  }
}
