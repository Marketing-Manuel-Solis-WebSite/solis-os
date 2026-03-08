import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { getTasks, createTask } from '@/lib/db-admin';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'tasks:read');
    if (!auth.valid) return auth.error!;

    const { limit, offset } = parsePagination(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const assignee = url.searchParams.get('assignee');
    const teamId = url.searchParams.get('teamId');

    let tasks = await getTasks(teamId || undefined) as any[];

    // Filter deleted
    tasks = tasks.filter((t: any) => !t.deleted);

    // Apply filters
    if (status) tasks = tasks.filter((t: any) => t.status === status);
    if (assignee) tasks = tasks.filter((t: any) => t.assignees?.includes(assignee));

    const total = tasks.length;
    const paginated = tasks.slice(offset, offset + limit);

    return apiResponse(paginated, { total, limit, offset });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'tasks:write');
    if (!auth.valid) return auth.error!;

    const body = await req.json();
    if (!body.title) return apiError('title is required', 400);

    const docRef = await createTask({
      title: body.title,
      description: body.description || '',
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      assignees: body.assignees || [],
      tags: body.tags || [],
      teamId: body.teamId || '',
      dueDate: body.dueDate || null,
      startDate: body.startDate || null,
      timeEstimate: body.timeEstimate || null,
      type: body.type || 'task',
      createdBy: `api:${auth.context!.keyRecord.prefix}`,
    });

    // Queue event for webhook delivery
    queueEvent({
      eventType: 'task.created',
      entityId: docRef.id,
      entityType: 'task',
      payload: { title: body.title, status: body.status || 'todo' },
    }).catch(() => {});

    return apiResponse({ id: docRef.id, ...body });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}
