import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { getTask } from '@/lib/db-admin';
import { onTimeTracked } from '@/lib/automation-engine';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, hours, minutes } = body;

    if (!taskId) {
      return Response.json({ error: 'taskId is required' }, { status: 400 });
    }

    const task = await getTask(taskId);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    await onTimeTracked(taskId, task, {
      hours: hours || 0,
      minutes: minutes || 0,
      userId: user.uid,
    }, user.uid);

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error('[API:automations/time-tracked] Error:', err?.message || err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
