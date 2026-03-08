import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle Discord interaction verification (URL_VERIFICATION equivalent)
    if (payload.type === 1) {
      return NextResponse.json({ type: 1 }); // PONG
    }

    const discordEvent = payload.type || 'unknown';

    await queueEvent({
      eventType: 'task.created',
      entityId: payload.id || '',
      entityType: 'discord_event',
      payload: {
        provider: 'discord',
        discordEventType: discordEvent,
        channelId: payload.channel_id || '',
        guildId: payload.guild_id || '',
        content: payload.content || payload.data?.name || '',
        author: payload.author?.username || payload.member?.user?.username || '',
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
