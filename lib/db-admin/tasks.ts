import 'server-only';

import {
  ORG, addTo, updateAt, deleteAt, getOne, getByOrg, getByTeam,
  deleteSubcollectionDocsAdmin, cleanupEntityRelationsAdmin,
  removeTaskFromGoalTargetsAdmin, cleanupOrphanedTimeEntriesAdmin,
  cleanupWhiteboardLinkedTaskRefsAdmin,
} from './helpers';

// ===== TASKS =====
export async function getTasks(teamId?: string) {
  if (teamId) return getByTeam('tasks', teamId);
  return getByOrg('tasks');
}

export async function getTask(id: string) { return getOne(`tasks/${id}`); }

export async function createTask(data: any) {
  const title = data.title || '';
  return addTo('tasks', {
    ...data, orgId: ORG, status: data.status || 'todo', priority: data.priority || 'medium',
    assignees: data.assignees || [], tags: data.tags || [], teamId: data.teamId || '',
    listId: data.listId || null,
    visibility: data.visibility || 'team',
    description: data.description || '', dueDate: data.dueDate || null, startDate: data.startDate || null,
    timeEstimate: data.timeEstimate || null, timeSpent: data.timeSpent || 0,
    subtasks: data.subtasks || [], checklist: data.checklist || [], attachments: data.attachments || [],
    customFields: data.customFields || {}, type: data.type || 'task', points: data.points || null,
    dependencies: data.dependencies || [], watchers: data.watchers || [], archived: false,
    createdBy: data.createdBy || '',
    titleLower: title.toLowerCase(),
  });
}

export async function updateTask(id: string, data: any) {
  const patch = data.title !== undefined ? { ...data, titleLower: data.title.toLowerCase() } : data;
  return updateAt(`tasks/${id}`, patch);
}
export async function deleteTask(id: string) {
  // Critical: detach from goal targets (affects goal progress integrity)
  // Must succeed before parent delete — throws on failure
  await removeTaskFromGoalTargetsAdmin(id);

  // Best-effort: orphan cleanup (logged, non-blocking)
  const bestEffort = [
    { name: 'comments', fn: () => deleteSubcollectionDocsAdmin(`tasks/${id}`, 'comments') },
    { name: 'activity', fn: () => deleteSubcollectionDocsAdmin(`tasks/${id}`, 'activity') },
    { name: 'relations', fn: () => cleanupEntityRelationsAdmin(id) },
    { name: 'timeEntries', fn: () => cleanupOrphanedTimeEntriesAdmin(id) },
    { name: 'whiteboardRefs', fn: () => cleanupWhiteboardLinkedTaskRefsAdmin(id) },
  ];
  const results = await Promise.allSettled(bestEffort.map(op => op.fn()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[deleteTask-admin] cascade ${bestEffort[i].name} failed for ${id}:`, r.reason);
  });
  return deleteAt(`tasks/${id}`);
}
