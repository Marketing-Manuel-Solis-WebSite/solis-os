// ============================================================
// Cron: Process Deadline Signals
// ============================================================
//
// Runs daily. Creates notifications + inbox items for:
//   1. Overdue tasks (dueDate < now, status != done)
//   2. Tasks due tomorrow
//   3. Goals at risk (status = at_risk | behind)
//
// Uses dedup via notifyUserAdmin to prevent repeats on each run.
// Auth: CRON_SECRET (same as process-webhooks).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { notifyUserAdmin } from '@/lib/notify-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { onTaskOverdue, onTaskDueApproaching } from '@/lib/automation-engine';



export async function GET(req: NextRequest) {
  // Auth: verify CRON_SECRET
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = { overdue: 0, dueSoon: 0, goalAtRisk: 0, errors: 0 };

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // 1. Overdue tasks: dueDate < now, not done, not deleted
    const overdueSnap = await adminDb
      .collection('tasks')
      .where('orgId', '==', ORG)
      .where('dueDate', '<', now)
      .where('status', 'in', ['todo', 'in_progress', 'review', 'blocked'])
      .limit(200)
      .get();

    const overdueTasks: { id: string; data: Record<string, any> }[] = [];
    for (const doc of overdueSnap.docs) {
      const task = doc.data();
      if (task.deleted) continue;
      overdueTasks.push({ id: doc.id, data: task });
      const assignees: string[] = task.assignees || [];
      for (const uid of assignees) {
        try {
          await notifyUserAdmin(uid, {
            eventType: 'task_overdue',
            title: task.title || 'Tarea vencida',
            message: `La tarea "${(task.title || '').slice(0, 80)}" ha vencido`,
            entityType: 'task',
            entityId: doc.id,
            entityUrl: '/app/tasks',
          });
          stats.overdue++;
        } catch { stats.errors++; }
      }
    }

    // Trigger automation rules for overdue tasks
    for (const task of overdueTasks) {
      try {
        await onTaskOverdue(task.id, task.data);
      } catch (err) {
        console.error('[Deadlines] automation trigger failed for overdue task:', task.id, err);
      }
    }

    // 2. Tasks due tomorrow
    const dueSoonSnap = await adminDb
      .collection('tasks')
      .where('orgId', '==', ORG)
      .where('dueDate', '>=', tomorrow)
      .where('dueDate', '<', dayAfterTomorrow)
      .where('status', 'in', ['todo', 'in_progress', 'review', 'blocked'])
      .limit(200)
      .get();

    const dueSoonTasks: { id: string; data: Record<string, any> }[] = [];
    for (const doc of dueSoonSnap.docs) {
      const task = doc.data();
      if (task.deleted) continue;
      dueSoonTasks.push({ id: doc.id, data: task });
      const assignees: string[] = task.assignees || [];
      for (const uid of assignees) {
        try {
          await notifyUserAdmin(uid, {
            eventType: 'task_due_soon',
            title: task.title || 'Tarea por vencer',
            message: `La tarea "${(task.title || '').slice(0, 80)}" vence mañana`,
            entityType: 'task',
            entityId: doc.id,
            entityUrl: '/app/tasks',
          });
          stats.dueSoon++;
        } catch { stats.errors++; }
      }
    }

    // Trigger automation rules for due-approaching tasks
    for (const task of dueSoonTasks) {
      try {
        await onTaskDueApproaching(task.id, task.data);
      } catch (err) {
        console.error('[Deadlines] automation trigger failed for due-approaching task:', task.id, err);
      }
    }

    // 3. Goals at risk
    const goalsSnap = await adminDb
      .collection('goals')
      .where('orgId', '==', ORG)
      .where('status', 'in', ['at_risk', 'behind'])
      .limit(100)
      .get();

    for (const doc of goalsSnap.docs) {
      const goal = doc.data();
      const ownerId = goal.ownerId;
      if (!ownerId) continue;
      try {
        await notifyUserAdmin(ownerId, {
          eventType: 'goal_overdue',
          title: goal.name || 'Objetivo en riesgo',
          message: `El objetivo "${(goal.name || '').slice(0, 80)}" está ${goal.status === 'at_risk' ? 'en riesgo' : 'atrasado'} — ${goal.progress || 0}%`,
          entityType: 'goal',
          entityId: doc.id,
          entityUrl: '/app/goals',
        });
        stats.goalAtRisk++;
      } catch { stats.errors++; }
    }

    return NextResponse.json({ ok: true, stats });
  } catch (err: any) {
    console.error('[process-deadlines] Fatal error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
