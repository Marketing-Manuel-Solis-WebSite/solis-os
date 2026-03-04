import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { getGoals, createGoal } from '@/lib/db';
import { queueEvent } from '@/lib/integrations-db';

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
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'goals:write');
    if (!auth.valid) return auth.error!;

    const body = await req.json();
    if (!body.name) return apiError('name is required', 400);

    const docRef = await createGoal({
      name: body.name,
      description: body.description || '',
      dueDate: body.dueDate || null,
      ownerId: body.ownerId || '',
      ownerName: body.ownerName || '',
      teamId: body.teamId || '',
      status: body.status || 'on_track',
      tags: body.tags || [],
      color: body.color || '#7B68EE',
      createdBy: `api:${auth.context!.keyRecord.prefix}`,
      createdByName: 'API',
    });

    queueEvent({
      eventType: 'goal.created',
      entityId: docRef.id,
      entityType: 'goal',
      payload: { name: body.name },
    }).catch(() => {});

    return apiResponse({ id: docRef.id, ...body });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}
