import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getTask, updateTask, deleteTask, syncGoalTargetsForTaskAdmin } from '@/lib/db-admin';
import { queueEvent } from '@/lib/integrations-db-admin';
import { TaskUpdateSchema, formatZodError } from '@/lib/validation';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'tasks:read');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const task = await getTask(id);
    if (!task) return apiError('Task not found', 404);

    return apiResponse(task);
  } catch {
    return apiError('Internal error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'tasks:write');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const task = await getTask(id);
    if (!task) return apiError('Task not found', 404);

    const body = await req.json();
    const parsed = TaskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(JSON.stringify(formatZodError(parsed.error)), 400);
    }
    const data = parsed.data;
    await updateTask(id, data);

    const statusChanged = data.status && data.status !== (task as any).status;
    const eventType = statusChanged ? 'task.status_changed' : 'task.updated';
    queueEvent({
      eventType,
      entityId: id,
      entityType: 'task',
      payload: { changes: Object.keys(data), ...(data.status ? { newStatus: data.status, oldStatus: (task as any).status } : {}) },
    }).catch(() => {});

    // Sync goal targets when task status changes (fire-and-forget)
    if (statusChanged) {
      syncGoalTargetsForTaskAdmin(id).catch(() => {});
    }

    return apiResponse({ id, ...data });
  } catch {
    return apiError('Internal error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'tasks:write');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const task = await getTask(id);
    if (!task) return apiError('Task not found', 404);

    await deleteTask(id);

    queueEvent({
      eventType: 'task.deleted',
      entityId: id,
      entityType: 'task',
      payload: { title: (task as any).title },
    }).catch(() => {});

    return apiResponse({ deleted: true, id });
  } catch {
    return apiError('Internal error', 500);
  }
}
