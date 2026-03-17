// ============================================================
// Calendar Sync — Bidirectional sync with Google Calendar
// and Outlook. Converts tasks with due dates to calendar
// events and vice versa.
// ============================================================

export interface CalendarEvent {
  id: string;
  externalId?: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  source: 'google' | 'outlook' | 'solis';
  taskId?: string;
  calendarId?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  lastSyncAt?: Date;
}

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: 'google' | 'outlook';
  accessToken: string;
  refreshToken: string;
  calendarId: string;
  calendarName: string;
  syncEnabled: boolean;
  syncDirection: 'both' | 'push' | 'pull';
  lastSyncAt?: Date;
  createdAt: Date;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
  syncedAt: Date;
}

/**
 * Convert a SOLIS task to a calendar event payload.
 */
export function taskToCalendarEvent(task: {
  id: string;
  title: string;
  description?: string;
  dueDate?: any;
  startDate?: any;
  timeEstimate?: number;
}): Omit<CalendarEvent, 'id' | 'externalId' | 'source' | 'syncStatus'> | null {
  const due = task.dueDate?.toDate?.() || (task.dueDate instanceof Date ? task.dueDate : null);
  if (!due) return null;

  const start = task.startDate?.toDate?.() || (task.startDate instanceof Date ? task.startDate : due);
  const estimateMs = (task.timeEstimate || 60) * 60 * 1000; // minutes → ms
  const end = new Date(start.getTime() + estimateMs);

  return {
    title: task.title,
    description: task.description || '',
    startDate: start,
    endDate: end,
    allDay: !task.timeEstimate,
    taskId: task.id,
  };
}

/**
 * Convert a calendar event to SOLIS task update payload.
 */
export function calendarEventToTaskUpdate(event: CalendarEvent): {
  dueDate: Date;
  startDate: Date;
  timeEstimate: number;
} {
  const durationMs = event.endDate.getTime() - event.startDate.getTime();
  const durationMinutes = Math.round(durationMs / (1000 * 60));

  return {
    dueDate: event.endDate,
    startDate: event.startDate,
    timeEstimate: event.allDay ? 0 : durationMinutes,
  };
}

/**
 * Sync tasks → Google Calendar (push).
 * Called from /api/integrations/calendar-sync endpoint.
 */
export async function pushToGoogleCalendar(
  accessToken: string,
  calendarId: string,
  events: Omit<CalendarEvent, 'id' | 'source' | 'syncStatus'>[],
): Promise<{ pushed: number; errors: string[] }> {
  const errors: string[] = [];
  let pushed = 0;

  for (const event of events) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: event.title,
            description: event.description || '',
            start: event.allDay
              ? { date: event.startDate.toISOString().slice(0, 10) }
              : { dateTime: event.startDate.toISOString() },
            end: event.allDay
              ? { date: event.endDate.toISOString().slice(0, 10) }
              : { dateTime: event.endDate.toISOString() },
            extendedProperties: {
              private: { solisTaskId: event.taskId || '' },
            },
          }),
        }
      );
      if (res.ok) pushed++;
      else errors.push(`Failed to push "${event.title}": ${res.status}`);
    } catch (err: any) {
      errors.push(`Push error for "${event.title}": ${err.message}`);
    }
  }

  return { pushed, errors };
}

/**
 * Pull events from Google Calendar.
 */
export async function pullFromGoogleCalendar(
  accessToken: string,
  calendarId: string,
  since?: Date,
): Promise<{ events: CalendarEvent[]; errors: string[] }> {
  const errors: string[] = [];
  try {
    const timeMin = (since || new Date(Date.now() - 30 * 86400000)).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&maxResults=100&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) {
      errors.push(`Pull failed: ${res.status}`);
      return { events: [], errors };
    }
    const data = await res.json();
    const events: CalendarEvent[] = (data.items || []).map((item: any) => ({
      id: item.id,
      externalId: item.id,
      title: item.summary || '',
      description: item.description || '',
      startDate: new Date(item.start?.dateTime || item.start?.date),
      endDate: new Date(item.end?.dateTime || item.end?.date),
      allDay: !!item.start?.date,
      source: 'google' as const,
      taskId: item.extendedProperties?.private?.solisTaskId || undefined,
      syncStatus: 'synced' as const,
    }));
    return { events, errors };
  } catch (err: any) {
    errors.push(`Pull error: ${err.message}`);
    return { events: [], errors };
  }
}

/**
 * Sync tasks ↔ Outlook Calendar (push).
 * Uses Microsoft Graph API.
 */
export async function pushToOutlookCalendar(
  accessToken: string,
  events: Omit<CalendarEvent, 'id' | 'source' | 'syncStatus'>[],
): Promise<{ pushed: number; errors: string[] }> {
  const errors: string[] = [];
  let pushed = 0;

  for (const event of events) {
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: event.title,
          body: { contentType: 'text', content: event.description || '' },
          start: { dateTime: event.startDate.toISOString(), timeZone: 'UTC' },
          end: { dateTime: event.endDate.toISOString(), timeZone: 'UTC' },
          isAllDay: event.allDay,
          extensions: [{ '@odata.type': 'microsoft.graph.openTypeExtension', extensionName: 'solis', taskId: event.taskId || '' }],
        }),
      });
      if (res.ok) pushed++;
      else errors.push(`Outlook push failed for "${event.title}": ${res.status}`);
    } catch (err: any) {
      errors.push(`Outlook push error: ${err.message}`);
    }
  }

  return { pushed, errors };
}
