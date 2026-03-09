import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getTask, updateTask, deleteTask, syncGoalTargetsForTaskAdmin, getCustomFieldDefs } from '@/lib/db-admin';
import { queueEvent } from '@/lib/integrations-db-admin';
import { TaskUpdateSchema, formatZodError, validateCustomFieldValues } from '@/lib/validation';
import { onTaskStatusChanged, onTaskAssigned } from '@/lib/automation-engine';

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

    // Validate custom fields against definitions (server-side enforcement)
    if (data.customFields && Object.keys(data.customFields).length > 0) {
      const fieldDefs = await getCustomFieldDefs();
      const cfResult = validateCustomFieldValues(data.customFields, fieldDefs);
      if (!cfResult.valid) {
        return apiError(`Custom field validation failed: ${cfResult.errors.join('; ')}`, 400);
      }
      data.customFields = cfResult.sanitized;
    }

    await updateTask(id, data);

    const statusChanged = data.status && data.status !== (task as any).status;
    const eventType = statusChanged ? 'task.status_changed' : 'task.updated';
    queueEvent({
      eventType,
      entityId: id,
      entityType: 'task',
      payload: { changes: Object.keys(data), ...(data.status ? { newStatus: data.status, oldStatus: (task as any).status } : {}) },
    }).catch((err) => console.error('[TasksAPI] queue webhook event failed:', err));

    // Sync goal targets when task status changes (fire-and-forget)
    if (statusChanged) {
      syncGoalTargetsForTaskAdmin(id).catch((err) => console.error('[TasksAPI] sync goal targets failed:', err));
    }

    // Trigger automation engine (fire-and-forget)
    const updatedTask = { ...(task as any), ...data };
    if (statusChanged) {
      onTaskStatusChanged(id, updatedTask, (task as any).status).catch((err) => console.error('[TasksAPI] automation status trigger failed:', err));
    }
    if (data.assignees && JSON.stringify(data.assignees) !== JSON.stringify((task as any).assignees)) {
      onTaskAssigned(id, updatedTask).catch((err) => console.error('[TasksAPI] automation assign trigger failed:', err));
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
    }).catch((err) => console.error('[TasksAPI] queue webhook event for delete failed:', err));

    return apiResponse({ deleted: true, id });
  } catch {
    return apiError('Internal error', 500);
  }
}
