import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { createTask, countByOrg, getCustomFieldDefs, queryTasksPaginated, getList } from '@/lib/db-admin';
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
    return apiError('Task operation failed', 500, 'INTERNAL');
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

    // Cross-space listId validation: listId must belong to same team
    if (data.listId && data.teamId) {
      const list = await getList(data.listId);
      if (!list) return apiError('listId does not exist', 400, 'INVALID_LIST');
      if ((list as any).spaceId !== data.teamId) {
        return apiError('listId does not belong to the specified team', 400, 'CROSS_SPACE_LIST');
      }
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
    return apiError('Task operation failed', 500, 'INTERNAL');
  }
}
