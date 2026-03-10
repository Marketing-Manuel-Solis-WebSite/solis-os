import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { createTask, countByOrg, getCustomFieldDefs, queryTasksPaginated } from '@/lib/db-admin';
import { TaskCreateSchema, formatZodError, validateCustomFieldValues } from '@/lib/validation';
import { afterTaskCreatedAdmin } from '@/lib/task-side-effects-admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'tasks:read');
    if (!auth.valid) return auth.error!;

    const { limit, cursor } = parsePagination(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const assignee = url.searchParams.get('assignee');
    const teamId = url.searchParams.get('teamId');

    // Firestore-native cursor pagination with pushed filters
    const [result, total] = await Promise.all([
      queryTasksPaginated({ limit, cursor, status, teamId, assignee }),
      countByOrg('tasks'),
    ]);

    return apiResponse(result.items, { total, limit, hasMore: result.hasMore, nextCursor: result.nextCursor });
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

    // Validate custom fields against definitions (server-side enforcement)
    if (data.customFields && Object.keys(data.customFields).length > 0) {
      const fieldDefs = await getCustomFieldDefs();
      const cfResult = validateCustomFieldValues(data.customFields, fieldDefs);
      if (!cfResult.valid) {
        return apiError(`Custom field validation failed: ${cfResult.errors.join('; ')}`, 400);
      }
      data.customFields = cfResult.sanitized;
    }

    const apiActor = `api:${auth.context!.keyRecord.prefix}`;
    const docRef = await createTask({
      ...data,
      createdBy: apiActor,
    });

    // Unified side effects — all awaited with error tracking
    await afterTaskCreatedAdmin({
      taskId: docRef.id,
      task: data,
      actor: { actorId: apiActor, actorName: apiActor },
    });

    return apiResponse({ id: docRef.id, ...data });
  } catch {
    return apiError('Internal error', 500);
  }
}
