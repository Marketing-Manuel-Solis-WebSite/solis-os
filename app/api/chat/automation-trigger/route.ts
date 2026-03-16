import { NextResponse } from 'next/server';
import { onChatMessageReceived } from '@/lib/chat-automation-trigger';

export async function POST(req: Request) {
  try {
    const { channelId, messageText, actorId, actorName } = await req.json();
    if (!channelId || !messageText) {
      return NextResponse.json({ error: 'Missing channelId or messageText' }, { status: 400 });
    }

    const result = await onChatMessageReceived(channelId, messageText, actorId, actorName);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
