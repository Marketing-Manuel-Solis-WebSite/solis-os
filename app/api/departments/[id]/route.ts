import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import {
  getTeam, updateTeam, deleteTeamAdmin,
  reassignTeamResourcesAdmin, purgeTeamResourcesAdmin,
} from '@/lib/db-admin';
import { TeamUpdateSchema, formatZodError } from '@/lib/validation';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const team = await getTeam(id);
    if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ team });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = TeamUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    await updateTeam(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'safe';
    const reassignTo = searchParams.get('reassignTo') || '';

    if (mode === 'safe' && reassignTo) {
      const targetTeam = await getTeam(reassignTo);
      const targetName = (targetTeam as any)?.name || '';
      await reassignTeamResourcesAdmin(id, reassignTo, targetName);
    } else if (mode === 'purge') {
      await purgeTeamResourcesAdmin(id);
    }

    await deleteTeamAdmin(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
