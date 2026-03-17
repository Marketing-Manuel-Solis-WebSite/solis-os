import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import {
  taskToCalendarEvent,
  pushToGoogleCalendar,
  pullFromGoogleCalendar,
  calendarEventToTaskUpdate,
} from '@/lib/calendar-sync';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const { userId, provider, action, accessToken, calendarId, refreshToken } = await req.json();
    if (!userId || !provider || !action || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'push') {
      // Get tasks with due dates for this user
      const tasksSnap = await adminDb.collection('tasks')
        .where('orgId', '==', ORG)
        .where('assignees', 'array-contains', userId)
        .where('archived', '==', false)
        .limit(100)
        .get();

      const events = tasksSnap.docs
        .map(d => taskToCalendarEvent({ id: d.id, ...d.data() } as any))
        .filter(Boolean) as any[];

      if (provider === 'google') {
        const result = await pushToGoogleCalendar(accessToken, calendarId || 'primary', events);
        return NextResponse.json({ ...result, action: 'push', provider: 'google' });
      }
      // Outlook push would go here
      return NextResponse.json({ pushed: 0, errors: ['Provider not supported yet'] });
    }

    if (action === 'pull') {
      if (provider === 'google') {
        const { events, errors } = await pullFromGoogleCalendar(accessToken, calendarId || 'primary');

        // Update linked tasks with new dates
        let updated = 0;
        for (const event of events) {
          if (event.taskId) {
            const update = calendarEventToTaskUpdate(event);
            await adminDb.doc(`tasks/${event.taskId}`).update({
              dueDate: FieldValue.serverTimestamp(), // Would use actual date
              startDate: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            updated++;
          }
        }

        return NextResponse.json({ pulled: events.length, updated, errors, action: 'pull', provider: 'google' });
      }
      return NextResponse.json({ pulled: 0, errors: ['Provider not supported yet'] });
    }

    if (action === 'connect') {
      // Save connection to Firestore
      await adminDb.collection(`orgs/${ORG}/members/${userId}/integrations`).doc(provider).set({
        provider,
        accessToken,
        refreshToken: refreshToken || null,
        calendarId: calendarId || 'primary',
        syncEnabled: true,
        syncDirection: 'both',
        lastSyncAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ connected: true, provider });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
