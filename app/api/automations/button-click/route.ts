import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { getTask } from '@/lib/db-admin';
import { onButtonFieldClick } from '@/lib/automation-engine';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, buttonFieldId } = body;

    if (!taskId || !buttonFieldId) {
      return Response.json({ error: 'taskId and buttonFieldId are required' }, { status: 400 });
    }

    const task = await getTask(taskId);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    await onButtonFieldClick(taskId, task, buttonFieldId, user.uid);

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error('[API:automations/button-click] Error:', err?.message || err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
