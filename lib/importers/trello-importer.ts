// ================================================================
// Trello Importer — Parse Trello JSON export into SOLIS OS tasks
// ================================================================

export interface TrelloBoard {
  name: string;
  lists: TrelloList[];
  cards: TrelloCard[];
  labels: TrelloLabel[];
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  due: string | null;
  labels: TrelloLabel[];
  closed: boolean;
  dateLastActivity: string;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

/** Map Trello list names to SOLIS statuses (best guess) */
const LIST_STATUS_MAP: Record<string, string> = {
  'to do': 'todo',
  'todo': 'todo',
  'doing': 'in_progress',
  'in progress': 'in_progress',
  'review': 'in_review',
  'in review': 'in_review',
  'done': 'done',
  'complete': 'done',
  'completed': 'done',
};

/**
 * Detect if a JSON file is a Trello export.
 */
export function isTrelloExport(data: any): boolean {
  return data && Array.isArray(data.cards) && Array.isArray(data.lists);
}

/**
 * Transform Trello JSON export into SOLIS task objects.
 */
export function parseTrelloExport(data: TrelloBoard, defaults: {
  teamId: string;
  createdBy: string;
  orgId: string;
}): any[] {
  const listMap = new Map(data.lists.map(l => [l.id, l]));

  return data.cards
    .filter(c => !c.closed)
    .map(card => {
      const list = listMap.get(card.idList);
      const listName = (list?.name || '').toLowerCase().trim();
      const status = LIST_STATUS_MAP[listName] || 'todo';
      const tags = card.labels.map(l => l.name).filter(Boolean);

      return {
        title: card.name,
        description: card.desc || '',
        status,
        priority: 'medium',
        type: 'task',
        visibility: 'team',
        assignees: [],
        tags,
        dueDate: card.due ? new Date(card.due) : null,
        startDate: null,
        timeEstimate: null,
        points: null,
        ...defaults,
        subtasks: [],
        checklist: [],
        attachments: [],
        customFields: {},
        dependencies: [],
        watchers: [],
        archived: false,
      };
    });
}
