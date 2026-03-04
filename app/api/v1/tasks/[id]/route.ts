import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError } from '../../middleware';
import { updateTask, deleteTask } from '@/lib/db';
import { queueEvent } from '@/lib/integrations-db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

async function getTask(id: string) {
  const snap = await getDoc(doc(db, `tasks/${id}`));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'tasks:read');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const task = await getTask(id);
    if (!task) return apiError('Task not found', 404);

    return apiResponse(task);
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
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
    await updateTask(id, body);

    // Queue events
    const eventType = body.status && body.status !== (task as any).status ? 'task.status_changed' : 'task.updated';
    queueEvent({
      eventType,
      entityId: id,
      entityType: 'task',
      payload: { changes: Object.keys(body), ...(body.status ? { newStatus: body.status, oldStatus: (task as any).status } : {}) },
    }).catch(() => {});

    return apiResponse({ id, ...body });
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
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
  } catch (err: any) {
    return apiError(err?.message || 'Internal error', 500);
  }
}
