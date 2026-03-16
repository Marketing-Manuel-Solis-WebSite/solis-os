'use client';

// ============================================================
// Workload Utilities — per-member capacity, utilization calc,
// and period-based workload aggregation.
// ============================================================

import { getMember, updateMember } from '@/lib/db';

const DEFAULT_CAPACITY = 40; // hours per week

/**
 * Read a member's weekly capacity from their Firestore doc.
 * Falls back to DEFAULT_CAPACITY (40h) when unset.
 */
export async function getMemberCapacity(memberId: string): Promise<number> {
  const member = await getMember(memberId);
  return (member as any)?.capacityHoursPerWeek ?? DEFAULT_CAPACITY;
}

/**
 * Persist a member's weekly capacity hours.
 */
export async function setMemberCapacity(memberId: string, hoursPerWeek: number): Promise<void> {
  await updateMember(memberId, { capacityHoursPerWeek: hoursPerWeek });
}

/**
 * Calculate utilization from a set of tasks against a capacity budget.
 * Tasks with status done/completed/closed are excluded automatically.
 */
export function calculateUtilization(
  tasks: Array<{ timeEstimate?: number; status?: string }>,
  capacityHours: number,
): { totalHours: number; utilization: number; status: 'underloaded' | 'optimal' | 'overloaded' } {
  const activeTasks = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s !== 'done' && s !== 'completed' && s !== 'closed';
  });
  const totalMinutes = activeTasks.reduce((sum, t) => sum + (t.timeEstimate || 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const utilization = capacityHours > 0 ? Math.round((totalHours / capacityHours) * 100) : 0;

  let status: 'underloaded' | 'optimal' | 'overloaded' = 'optimal';
  if (utilization < 50) status = 'underloaded';
  else if (utilization > 100) status = 'overloaded';

  return { totalHours, utilization, status };
}

/**
 * Aggregate workload for every member over a given period.
 * Scales each member's weekly capacity by period multiplier.
 */
export function getWorkloadForPeriod(
  members: Array<{ id: string; capacityHoursPerWeek?: number }>,
  tasks: Array<{ assignees?: string[]; timeEstimate?: number; status?: string; dueDate?: any }>,
  period: 'week' | 'month',
): Array<{
  memberId: string;
  capacity: number;
  totalHours: number;
  utilization: number;
  status: 'underloaded' | 'optimal' | 'overloaded';
  taskCount: number;
}> {
  const multiplier = period === 'month' ? 4.33 : 1;

  return members.map(m => {
    const weeklyCapacity = m.capacityHoursPerWeek ?? DEFAULT_CAPACITY;
    const periodCapacity = Math.round(weeklyCapacity * multiplier);
    const memberTasks = tasks.filter(t => (t.assignees || []).includes(m.id));
    const { totalHours, utilization, status } = calculateUtilization(memberTasks, periodCapacity);

    return {
      memberId: m.id,
      capacity: periodCapacity,
      totalHours,
      utilization,
      status,
      taskCount: memberTasks.length,
    };
  });
}

export { DEFAULT_CAPACITY };
