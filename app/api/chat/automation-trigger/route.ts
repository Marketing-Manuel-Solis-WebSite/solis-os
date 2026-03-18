import { NextResponse } from 'next/server';
import { onChatMessageReceived } from '@/lib/chat-automation-trigger';
import { authenticateRequest } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId, messageText, actorId, actorName } = await req.json();
    if (!channelId || !messageText) {
      return NextResponse.json({ error: 'Missing channelId or messageText' }, { status: 400 });
    }

    const result = await onChatMessageReceived(channelId, messageText, actorId, actorName);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
