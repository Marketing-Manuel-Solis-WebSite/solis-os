import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/server-auth';
import { getTeams, createTeam } from '@/lib/db-admin';
import { TeamCreateSchema, formatZodError } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teams = await getTeams();
    return NextResponse.json({ teams });
  } catch (err) {
    console.error('[Departments] GET failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authedUser = await requireAdmin(req);
    if (authedUser instanceof Response) return authedUser;

    const body = await req.json();
    const parsed = TeamCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const id = await createTeam(parsed.data);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[Departments] POST failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
