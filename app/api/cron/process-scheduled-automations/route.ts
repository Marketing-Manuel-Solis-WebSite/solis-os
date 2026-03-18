import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { shouldTriggerNow } from '@/lib/scheduled-triggers';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyUsersAdmin } from '@/lib/notify-admin';

const SCHEDULED_TRIGGERS = ['scheduled_daily', 'scheduled_weekly', 'scheduled_monthly', 'schedule_cron'];

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
        : rule.trigger === 'schedule_cron' ? 'cron'
        : 'monthly';

      const triggerConfig = {
        frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'cron',
        atHour: parseInt(config.atHour || '9', 10),
        atMinute: parseInt(config.atMinute || '0', 10),
        dayOfWeek: config.dayOfWeek != null ? parseInt(config.dayOfWeek, 10) : undefined,
        dayOfMonth: config.dayOfMonth != null ? parseInt(config.dayOfMonth, 10) : undefined,
        cronExpression: config.cronExpression || undefined,
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
          // Check conditions (mirrors automation-engine evaluateCondition — fail-closed)
          const conditionsPass = (rule.conditions || []).every((c: any) => {
            const rawVal = (() => {
              switch (c.field) {
                case 'assignee_count': return task.assignees?.length > 0 ? 'yes' : 'no';
                case 'has_due_date': return task.dueDate ? 'yes' : 'no';
                default: return task[c.field];
              }
            })();
            switch (c.operator) {
              case 'equals': return String(rawVal) === String(c.value);
              case 'not_equals': return String(rawVal) !== String(c.value);
              case 'contains':
                if (Array.isArray(rawVal)) return rawVal.some((v: any) => String(v) === String(c.value));
                return String(rawVal || '').includes(String(c.value));
              case 'not_contains':
                if (Array.isArray(rawVal)) return !rawVal.some((v: any) => String(v) === String(c.value));
                return !String(rawVal || '').includes(String(c.value));
              case 'is_empty': return rawVal === undefined || rawVal === null || rawVal === '' || (Array.isArray(rawVal) && rawVal.length === 0);
              case 'is_not_empty': return rawVal !== undefined && rawVal !== null && rawVal !== '' && !(Array.isArray(rawVal) && rawVal.length === 0);
              case 'greater_than': return Number(rawVal) > Number(c.value);
              case 'less_than': return Number(rawVal) < Number(c.value);
              case 'greater_than_or_equal': return Number(rawVal) >= Number(c.value);
              case 'less_than_or_equal': return Number(rawVal) <= Number(c.value);
              case 'starts_with': return String(rawVal || '').startsWith(String(c.value));
              case 'ends_with': return String(rawVal || '').endsWith(String(c.value));
              default: return false; // Unknown operator — fail-closed
            }
          });

          if (!conditionsPass) continue;

          // Execute all action types (mirrors automation-engine executeAction)
          const sorted = [...(rule.actions || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          for (const action of sorted) {
            try {
              const taskRef = adminDb.doc(`tasks/${taskDoc.id}`);
              const cfg = action.config || {};
              switch (action.type) {
                case 'change_status':
                  if (cfg.toStatus || cfg.status) await taskRef.update({ status: cfg.toStatus || cfg.status, updatedAt: FieldValue.serverTimestamp() });
                  break;
                case 'set_priority':
                  if (cfg.toPriority || cfg.priority) await taskRef.update({ priority: cfg.toPriority || cfg.priority, updatedAt: FieldValue.serverTimestamp() });
                  break;
                case 'assign_user':
                  if (cfg.assigneeId) await taskRef.update({ assignees: FieldValue.arrayUnion(cfg.assigneeId), updatedAt: FieldValue.serverTimestamp() });
                  break;
                case 'add_tag':
                  if (cfg.tagName) await taskRef.update({ tags: FieldValue.arrayUnion(cfg.tagName) });
                  break;
                case 'remove_tag':
                  if (cfg.tagName) await taskRef.update({ tags: FieldValue.arrayRemove(cfg.tagName) });
                  break;
                case 'post_comment':
                  if (cfg.commentText) {
                    await adminDb.collection(`tasks/${taskDoc.id}/comments`).add({
                      text: cfg.commentText,
                      authorId: 'automation',
                      authorName: `Scheduled: ${rule.name}`,
                      automationId: rule.id,
                      automationName: rule.name,
                      createdAt: FieldValue.serverTimestamp(),
                    });
                  }
                  break;
                case 'send_notification': {
                  const message = cfg.message || `Automation triggered on "${task.title}"`;
                  const assignees: string[] = task.assignees || [];
                  if (assignees.length > 0) {
                    await notifyUsersAdmin(assignees, {
                      eventType: 'system',
                      title: 'Automation',
                      message,
                      entityType: 'task',
                      entityId: taskDoc.id,
                      entityUrl: '/app/tasks',
                    });
                  }
                  break;
                }
                case 'call_webhook': {
                  const url = cfg.webhookUrl;
                  const method = (cfg.method || 'POST') as string;
                  if (url) {
                    const resp = await fetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        event: 'automation_triggered',
                        taskId: taskDoc.id,
                        task: { title: task.title, status: task.status, priority: task.priority },
                        actorId: 'system',
                        timestamp: new Date().toISOString(),
                      }),
                    });
                    if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`);
                  }
                  break;
                }
                case 'create_subtask': {
                  if (cfg.subtaskTitle) {
                    const taskSnap = await adminDb.doc(`tasks/${taskDoc.id}`).get();
                    const currentSubtasks = taskSnap.data()?.subtasks || [];
                    await taskRef.update({
                      subtasks: [...currentSubtasks, { id: Date.now().toString(36), title: cfg.subtaskTitle, done: false }],
                      updatedAt: FieldValue.serverTimestamp(),
                    });
                  }
                  break;
                }
                case 'archive_task':
                  await taskRef.update({ archived: true, updatedAt: FieldValue.serverTimestamp() });
                  break;
                case 'duplicate_task': {
                  const snap = await taskRef.get();
                  if (snap.exists) {
                    const data = snap.data()!;
                    await adminDb.collection('tasks').add({
                      ...data,
                      title: `${data.title || 'Task'} (copy)`,
                      createdAt: FieldValue.serverTimestamp(),
                      updatedAt: FieldValue.serverTimestamp(),
                      createdBy: 'automation',
                      archived: false,
                      deleted: false,
                    });
                  }
                  break;
                }
                case 'move_to_list':
                  if (cfg.listId) await taskRef.update({ listId: cfg.listId, updatedAt: FieldValue.serverTimestamp() });
                  break;
                case 'apply_template': {
                  if (cfg.templateId) {
                    const { applyTaskTemplate } = await import('@/lib/task-templates');
                    const taskData = await applyTaskTemplate(cfg.templateId, {
                      teamId: task.teamId || '',
                      spaceId: task.spaceId || '',
                      listId: task.listId || '',
                      createdBy: 'automation',
                    });
                    await adminDb.collection('tasks').add({
                      ...taskData,
                      orgId: ORG,
                      parentTaskId: taskDoc.id,
                      createdAt: FieldValue.serverTimestamp(),
                      updatedAt: FieldValue.serverTimestamp(),
                    });
                  }
                  break;
                }
                case 'create_task': {
                  const taskTitle = cfg.taskTitle || cfg.title || `Task from automation`;
                  await adminDb.collection('tasks').add({
                    orgId: ORG,
                    title: taskTitle,
                    titleLower: taskTitle.toLowerCase(),
                    status: cfg.status || 'todo',
                    priority: cfg.priority || 'medium',
                    type: cfg.type || 'task',
                    teamId: task.teamId || rule.teamId || '',
                    listId: cfg.listId || task.listId || null,
                    listIds: cfg.listId ? [cfg.listId] : (task.listId ? [task.listId] : []),
                    assignees: cfg.assignees || [],
                    tags: cfg.tags || [],
                    description: cfg.description || '',
                    createdBy: 'automation',
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    archived: false,
                    deleted: false,
                    dependencies: [],
                    customFields: {},
                    watchers: [],
                    subtasks: [],
                    checklist: [],
                    attachments: [],
                  });
                  break;
                }
                default:
                  console.warn(`[ScheduledAutomation] Unsupported action type: ${action.type}`);
                  break;
              }
              actionsExecuted++;
            } catch (actionErr: any) {
              console.error(`[ScheduledAutomation] Action ${action.type} failed on task ${taskDoc.id}:`, actionErr?.message);
              // Continue to next action — don't break the loop for one failed action
            }
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
