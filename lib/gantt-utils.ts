// ============================================================
// Gantt Utilities — Critical path, date cascading, constraint
// validation for the Gantt chart view.
// ============================================================

import type { TaskDependency } from '@/types';

export interface GanttTask {
  id: string;
  title: string;
  startDate?: any;
  dueDate?: any;
  dependencies: TaskDependency[] | string[];
  type?: string;
  status?: string;
}

// ─── Date helpers (tolerant of Firestore timestamps) ────────

function toDate(d: any): Date {
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  if (d?.seconds) return new Date(d.seconds * 1000);
  return new Date(d);
}

function getDurationDays(task: GanttTask | undefined): number {
  if (!task?.startDate || !task?.dueDate) return 1;
  const start = toDate(task.startDate);
  const end = toDate(task.dueDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

// ─── Normalize dependency format ────────────────────────────
// The constants.ts Task uses string[] while types/index.ts uses TaskDependency[].
// This helper normalises both forms into a blocker-id set.

function getBlockerIds(deps: TaskDependency[] | string[]): string[] {
  if (!deps?.length) return [];
  if (typeof deps[0] === 'string') return deps as string[];
  return (deps as TaskDependency[])
    .filter(d => d.type === 'blocked_by')
    .map(d => d.taskId);
}

// ─── Critical Path ──────────────────────────────────────────
// Compute critical path using longest-path algorithm on the
// dependency DAG via topological sort.

export function computeCriticalPath(
  tasks: GanttTask[],
  dependencies: Map<string, string[]>, // taskId -> blocked taskIds
): Set<string> {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();

  // Build graph
  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
    dist.set(t.id, 0);
  }

  for (const [blockerId, blockedIds] of dependencies) {
    for (const blockedId of blockedIds) {
      if (!adj.has(blockerId) || !inDegree.has(blockedId)) continue;
      adj.get(blockerId)!.push(blockedId);
      inDegree.set(blockedId, (inDegree.get(blockedId) || 0) + 1);
    }
  }

  // Topological sort + longest path
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currTask = taskMap.get(curr);
    const duration = getDurationDays(currTask);

    for (const next of (adj.get(curr) || [])) {
      const newDist = (dist.get(curr) || 0) + duration;
      if (newDist > (dist.get(next) || 0)) {
        dist.set(next, newDist);
        prev.set(next, curr);
      }
      inDegree.set(next, (inDegree.get(next) || 0) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  // Find end node with max distance
  let maxDist = 0;
  let endNode = '';
  for (const [id, d] of dist) {
    if (d >= maxDist) { maxDist = d; endNode = id; }
  }

  // Trace back critical path
  const criticalPath = new Set<string>();
  let node = endNode;
  while (node) {
    criticalPath.add(node);
    node = prev.get(node) || '';
  }

  return criticalPath;
}

// ─── Cascade Dates ──────────────────────────────────────────
// When a task is moved by `deltaDays`, cascade the shift to all
// downstream (blocked) tasks.

export function cascadeDates(
  movedTaskId: string,
  deltaDays: number,
  tasks: GanttTask[],
  deps: Map<string, string[]>,
): Array<{ taskId: string; newStart: Date; newEnd: Date }> {
  const result: Array<{ taskId: string; newStart: Date; newEnd: Date }> = [];
  const visited = new Set<string>();

  function cascade(taskId: string, delta: number) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const blockedIds = deps.get(taskId) || [];
    for (const blockedId of blockedIds) {
      const task = tasks.find(t => t.id === blockedId);
      if (!task) continue;

      const start = toDate(task.startDate || task.dueDate || new Date());
      const end = toDate(task.dueDate || task.startDate || new Date());

      const newStart = new Date(start.getTime() + delta * 86400000);
      const newEnd = new Date(end.getTime() + delta * 86400000);

      result.push({ taskId: blockedId, newStart, newEnd });
      cascade(blockedId, delta);
    }
  }

  cascade(movedTaskId, deltaDays);
  return result;
}

// ─── Validate Dependency Constraints ────────────────────────
// Check whether moving a task to [newStart, newEnd] would
// violate any dependency ordering.

export function validateDependencyConstraints(
  taskId: string,
  newStart: Date,
  newEnd: Date,
  tasks: GanttTask[],
  deps: Map<string, string[]>,
): Array<{ taskId: string; type: string; message: string }> {
  const violations: Array<{ taskId: string; type: string; message: string }> = [];

  const task = tasks.find(t => t.id === taskId);
  if (!task) return violations;

  // Check blockers: tasks that block this one must end before newStart
  const blockerIds = getBlockerIds(task.dependencies);
  for (const blockerId of blockerIds) {
    const blocker = tasks.find(t => t.id === blockerId);
    if (blocker?.dueDate) {
      const blockerEnd = toDate(blocker.dueDate);
      if (newStart < blockerEnd) {
        violations.push({
          taskId: blockerId,
          type: 'blocker_overlap',
          message: `Start date overlaps with blocker "${blocker.title}"`,
        });
      }
    }
  }

  // Check blocked: tasks blocked by this one must start after newEnd
  const blockedIds = deps.get(taskId) || [];
  for (const blockedId of blockedIds) {
    const blocked = tasks.find(t => t.id === blockedId);
    if (blocked?.startDate) {
      const blockedStart = toDate(blocked.startDate);
      if (newEnd > blockedStart) {
        violations.push({
          taskId: blockedId,
          type: 'dependent_overlap',
          message: `End date overlaps with dependent "${blocked.title}"`,
        });
      }
    }
  }

  return violations;
}

// ─── Build Dependency Map ───────────────────────────────────
// Convenience: build a Map<blockerId, blockedId[]> from a task
// list, handling both string[] and TaskDependency[] formats.

export function buildDependencyMap(tasks: GanttTask[]): Map<string, string[]> {
  const deps = new Map<string, string[]>();

  for (const task of tasks) {
    if (!task.dependencies?.length) continue;

    const blockerIds = getBlockerIds(task.dependencies);
    for (const blockerId of blockerIds) {
      const list = deps.get(blockerId);
      if (list) list.push(task.id);
      else deps.set(blockerId, [task.id]);
    }

    // If dependencies is string[], each id is treated as a blocker
    if (typeof task.dependencies[0] === 'string') {
      for (const depId of task.dependencies as string[]) {
        const list = deps.get(depId);
        if (list) {
          if (!list.includes(task.id)) list.push(task.id);
        } else {
          deps.set(depId, [task.id]);
        }
      }
    }
  }

  return deps;
}
