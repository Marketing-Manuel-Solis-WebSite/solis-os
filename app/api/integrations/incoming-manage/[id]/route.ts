import { NextRequest, NextResponse } from 'next/server';
import { deleteIncomingWebhook } from '@/lib/integrations-db-admin';
import { authenticateAdmin } from '@/lib/server-auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authedUser = await authenticateAdmin(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized – admin role required' }, { status: 403 });
    }

    const { id } = await params;
    await deleteIncomingWebhook(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
