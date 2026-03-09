import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { getTasks, createTask } from '@/lib/db-admin';
import { queueEvent } from '@/lib/integrations-db-admin';
import { TaskCreateSchema, formatZodError } from '@/lib/validation';

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
  } catch {
    return apiError('Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'tasks:write');
    if (!auth.valid) return auth.error!;

    const body = await req.json();
    const parsed = TaskCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(JSON.stringify(formatZodError(parsed.error)), 400);
    }
    const data = parsed.data;

    const docRef = await createTask({
      ...data,
      createdBy: `api:${auth.context!.keyRecord.prefix}`,
    });

    // Queue event for webhook delivery
    queueEvent({
      eventType: 'task.created',
      entityId: docRef.id,
      entityType: 'task',
      payload: { title: data.title, status: data.status },
    }).catch(() => {});

    return apiResponse({ id: docRef.id, ...data });
  } catch {
    return apiError('Internal error', 500);
  }
}
