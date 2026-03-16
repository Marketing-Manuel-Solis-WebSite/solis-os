import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server-auth';
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/connectors/google-calendar';

const SAFE_EVENT_ID = /^[a-zA-Z0-9_-]+$/;

// GET /api/integrations/calendar/events?timeMin=...&timeMax=...&maxResults=...
export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get('timeMin') || undefined;
  const timeMax = searchParams.get('timeMax') || undefined;
  const maxResults = Math.min(Number(searchParams.get('maxResults')) || 20, 100);

  try {
    const events = await listCalendarEvents(timeMin, timeMax, maxResults);
    return NextResponse.json({ events });
  } catch (err: any) {
    console.error('[Calendar] GET error:', err);
    return NextResponse.json({ error: 'Calendar operation failed' }, { status: 500 });
  }
}

// POST /api/integrations/calendar/events
export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { summary, startDateTime, endDateTime, description, location } = body;

    if (!summary || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'summary, startDateTime, and endDateTime are required' },
        { status: 400 },
      );
    }

    const event = await createCalendarEvent(summary, startDateTime, endDateTime, description, location);
    if (!event) {
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({ event });
  } catch (err: any) {
    console.error('[Calendar] POST error:', err);
    return NextResponse.json({ error: 'Calendar operation failed' }, { status: 500 });
  }
}

// PATCH /api/integrations/calendar/events (with eventId in body)
export async function PATCH(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { eventId, ...updates } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }
    if (!SAFE_EVENT_ID.test(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId format' }, { status: 400 });
    }

    const event = await updateCalendarEvent(eventId, updates);
    if (!event) {
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    return NextResponse.json({ event });
  } catch (err: any) {
    console.error('[Calendar] PATCH error:', err);
    return NextResponse.json({ error: 'Calendar operation failed' }, { status: 500 });
  }
}

// DELETE /api/integrations/calendar/events (with eventId in body)
export async function DELETE(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }
    if (!SAFE_EVENT_ID.test(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId format' }, { status: 400 });
    }

    const ok = await deleteCalendarEvent(eventId);
    if (!ok) {
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Calendar] DELETE error:', err);
    return NextResponse.json({ error: 'Calendar operation failed' }, { status: 500 });
  }
}
