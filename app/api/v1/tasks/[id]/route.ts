import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { getTask, updateTask, deleteTask, getCustomFieldDefs } from '@/lib/db-admin';
import { TaskUpdateSchema, formatZodError, validateCustomFieldValues } from '@/lib/validation';
import { afterTaskUpdatedAdmin, afterTaskDeletedAdmin } from '@/lib/task-side-effects-admin';

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

    // Unified side effects — all awaited with error tracking
    const apiActor = `api:${auth.context!.keyRecord.prefix}`;
    // Process each changed field through the dispatcher
    for (const field of Object.keys(data)) {
      await afterTaskUpdatedAdmin({
        taskId: id,
        task: task as Record<string, any>,
        field,
        from: (task as any)[field],
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
    const auth = await validateApiRequest(req, 'tasks:write');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const task = await getTask(id);
    if (!task) return apiError('Task not found', 404);

    await deleteTask(id);

    // Unified side effects — all awaited with error tracking
    const apiActorDel = `api:${auth.context!.keyRecord.prefix}`;
    await afterTaskDeletedAdmin({
      taskId: id,
      task: task as Record<string, any>,
      actor: { actorId: apiActorDel, actorName: apiActorDel },
    });

    return apiResponse({ deleted: true, id });
  } catch {
    return apiError('Internal error', 500);
  }
}
