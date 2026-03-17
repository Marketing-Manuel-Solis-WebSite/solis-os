import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import { onChatMessageReceived } from '@/lib/automation-engine';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { channelId, text, authorName, teamId, spaceId } = body;

    if (!channelId || !text) {
      return Response.json({ error: 'channelId and text are required' }, { status: 400 });
    }

    await onChatMessageReceived(
      channelId,
      { text, authorId: user.uid, authorName: authorName || '' },
      { teamId, spaceId },
    );

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error('[API:automations/chat-trigger] Error:', err?.message || err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
