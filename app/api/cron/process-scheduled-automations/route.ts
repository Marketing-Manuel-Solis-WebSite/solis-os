import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { shouldTriggerNow } from '@/lib/scheduled-triggers';
import { FieldValue } from 'firebase-admin/firestore';

const SCHEDULED_TRIGGERS = ['scheduled_daily', 'scheduled_weekly', 'scheduled_monthly'];

export async function GET(req: Request) {
  // Auth check — same pattern as other cron endpoints
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Query all enabled scheduled automations
    const snap = await adminDb.collection('automations')
      .where('orgId', '==', ORG)
      .where('enabled', '==', true)
      .get();

    const rules = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((r: any) => SCHEDULED_TRIGGERS.includes(r.trigger));

    const results: { ruleId: string; ruleName: string; triggered: boolean; error?: string }[] = [];
    const now = new Date();

    for (const rule of rules as any[]) {
      const config = rule.triggerConfig || {};
      const lastRunAt = rule.lastRunAt?.toDate?.() || null;

      // Map trigger type to frequency
      const frequency = rule.trigger === 'scheduled_daily' ? 'daily'
        : rule.trigger === 'scheduled_weekly' ? 'weekly'
        : 'monthly';

      const triggerConfig = {
        frequency: frequency as 'daily' | 'weekly' | 'monthly',
        atHour: parseInt(config.atHour || '9', 10),
        atMinute: parseInt(config.atMinute || '0', 10),
        dayOfWeek: config.dayOfWeek != null ? parseInt(config.dayOfWeek, 10) : undefined,
        dayOfMonth: config.dayOfMonth != null ? parseInt(config.dayOfMonth, 10) : undefined,
        timezone: config.timezone || 'UTC',
      };

      if (!shouldTriggerNow(triggerConfig, lastRunAt, now)) {
        results.push({ ruleId: rule.id, ruleName: rule.name, triggered: false });
        continue;
      }

      try {
        // Get tasks matching the rule scope for batch processing
        let tasksQuery = adminDb.collection('tasks')
          .where('orgId', '==', ORG)
          .where('archived', '==', false);

        if (rule.teamId) tasksQuery = tasksQuery.where('teamId', '==', rule.teamId);
        if (rule.listId) tasksQuery = tasksQuery.where('listId', '==', rule.listId);

        const tasksSnap = await tasksQuery.limit(100).get();

        // Evaluate conditions and execute actions on matching tasks
        let actionsExecuted = 0;
        for (const taskDoc of tasksSnap.docs) {
          const task = taskDoc.data();
          // Check conditions
          const conditionsPass = (rule.conditions || []).every((c: any) => {
            const val = task[c.field];
            switch (c.operator) {
              case 'equals': return String(val) === String(c.value);
              case 'not_equals': return String(val) !== String(c.value);
              case 'contains': return String(val || '').includes(c.value);
              case 'is_empty': return !val || val === '';
              case 'is_not_empty': return val && val !== '';
              default: return true;
            }
          });

          if (!conditionsPass) continue;

          // Execute actions (simplified — delegates to automation engine for complex actions)
          for (const action of rule.actions || []) {
            const taskRef = adminDb.doc(`tasks/${taskDoc.id}`);
            switch (action.type) {
              case 'change_status':
                if (action.config.status) await taskRef.update({ status: action.config.status, updatedAt: FieldValue.serverTimestamp() });
                break;
              case 'set_priority':
                if (action.config.priority) await taskRef.update({ priority: action.config.priority, updatedAt: FieldValue.serverTimestamp() });
                break;
              case 'add_tag':
                if (action.config.tagName) await taskRef.update({ tags: FieldValue.arrayUnion(action.config.tagName) });
                break;
              case 'post_comment':
                if (action.config.commentText) {
                  await adminDb.collection(`tasks/${taskDoc.id}/comments`).add({
                    text: action.config.commentText,
                    authorId: 'automation',
                    authorName: `Scheduled: ${rule.name}`,
                    createdAt: FieldValue.serverTimestamp(),
                  });
                }
                break;
            }
            actionsExecuted++;
          }
        }

        // Update rule stats
        await adminDb.doc(`automations/${rule.id}`).update({
          lastRunAt: FieldValue.serverTimestamp(),
          runCount: FieldValue.increment(1),
          consecutiveErrors: 0,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Log execution
        await adminDb.collection(`automations/${rule.id}/logs`).add({
          status: 'success',
          actionsExecuted,
          tasksProcessed: tasksSnap.size,
          triggerType: rule.trigger,
          createdAt: FieldValue.serverTimestamp(),
        });

        results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true });
      } catch (err: any) {
        // Track errors
        const consecutiveErrors = (rule.consecutiveErrors || 0) + 1;
        const updates: Record<string, any> = {
          errorCount: FieldValue.increment(1),
          consecutiveErrors,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (consecutiveErrors >= 5) {
          updates.enabled = false;
          updates.disabledAt = FieldValue.serverTimestamp();
          updates.disabledReason = `Auto-disabled after 5 consecutive errors: ${err.message}`;
        }
        await adminDb.doc(`automations/${rule.id}`).update(updates);

        results.push({ ruleId: rule.id, ruleName: rule.name, triggered: false, error: err.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
