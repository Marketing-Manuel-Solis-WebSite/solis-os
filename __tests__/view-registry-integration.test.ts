import { describe, it, expect, vi } from 'vitest';

// Mock Firebase (required by view components transitively)
vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), serverTimestamp: vi.fn(),
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
  getDocs: vi.fn(), onSnapshot: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), limit: vi.fn(), startAfter: vi.fn(), Timestamp: { now: vi.fn() },
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(), onAuthStateChanged: vi.fn(), signOut: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn(),
}));

// Import registration side-effect
import '../lib/views/register-views';
import { getView, getAllViews, hasView } from '../lib/views';

describe('View Registry — Built-in Registration', () => {
  const ALL_VIEW_IDS = ['list', 'board', 'calendar', 'table', 'gantt', 'timeline', 'workload', 'team', 'embed', 'activity'] as const;

  it('registers all 10 built-in views', () => {
    for (const id of ALL_VIEW_IDS) {
      expect(hasView(id)).toBe(true);
    }
  });

  it('getAllViews returns exactly 10 entries', () => {
    expect(getAllViews().length).toBe(10);
  });

  it('list view has correct metadata', () => {
    const list = getView('list');
    expect(list).toBeDefined();
    expect(list!.name).toBe('List');
    expect(list!.nameEs).toBe('Lista');
    expect(list!.iconName).toBe('LayoutList');
    expect(list!.shortcut).toBe('1');
    expect(list!.capabilities.sort).toBe(true);
    expect(list!.capabilities.bulkSelect).toBe(true);
    expect(list!.capabilities.calendarMode).toBe(false);
  });

  it('board view has correct metadata', () => {
    const board = getView('board');
    expect(board).toBeDefined();
    expect(board!.name).toBe('Board');
    expect(board!.nameEs).toBe('Tablero');
    expect(board!.iconName).toBe('LayoutGrid');
    expect(board!.capabilities.groupBy).toBe(true);
    expect(board!.capabilities.columns).toBe(false);
  });

  it('calendar view has correct metadata', () => {
    const cal = getView('calendar');
    expect(cal).toBeDefined();
    expect(cal!.name).toBe('Calendar');
    expect(cal!.nameEs).toBe('Calendario');
    expect(cal!.capabilities.calendarMode).toBe(true);
    expect(cal!.capabilities.sort).toBe(false);
  });

  it('table view has correct metadata', () => {
    const table = getView('table');
    expect(table).toBeDefined();
    expect(table!.name).toBe('Table');
    expect(table!.nameEs).toBe('Tabla');
    expect(table!.iconName).toBe('Table2');
    expect(table!.shortcut).toBe('4');
    expect(table!.capabilities.groupBy).toBe(true);
    expect(table!.capabilities.sort).toBe(true);
    expect(table!.capabilities.filter).toBe(true);
  });

  it('gantt view has correct metadata', () => {
    const gantt = getView('gantt');
    expect(gantt).toBeDefined();
    expect(gantt!.name).toBe('Gantt');
    expect(gantt!.nameEs).toBe('Gantt');
    expect(gantt!.iconName).toBe('GanttChart');
    expect(gantt!.shortcut).toBe('5');
    expect(gantt!.capabilities.filter).toBe(true);
    expect(gantt!.capabilities.sort).toBe(false);
  });

  it('timeline view has correct metadata', () => {
    const timeline = getView('timeline');
    expect(timeline).toBeDefined();
    expect(timeline!.name).toBe('Timeline');
    expect(timeline!.nameEs).toBe('Cronograma');
    expect(timeline!.iconName).toBe('Clock');
    expect(timeline!.shortcut).toBe('6');
    expect(timeline!.capabilities.filter).toBe(true);
    expect(timeline!.capabilities.sort).toBe(false);
  });

  it('workload view has correct metadata', () => {
    const workload = getView('workload');
    expect(workload).toBeDefined();
    expect(workload!.name).toBe('Workload');
    expect(workload!.nameEs).toBe('Carga');
    expect(workload!.iconName).toBe('BarChart3');
    expect(workload!.shortcut).toBe('7');
    expect(workload!.capabilities.filter).toBe(true);
    expect(workload!.capabilities.sort).toBe(false);
  });

  it('each view has a component function', () => {
    for (const entry of getAllViews()) {
      expect(typeof entry.component).toBe('function');
    }
  });

  it('all 8 views with shortcuts have unique shortcut keys 1-8', () => {
    const views = getAllViews();
    const shortcuts = views.map(v => v.shortcut).filter(Boolean);
    expect(shortcuts.length).toBe(8);
    expect(new Set(shortcuts).size).toBe(8);
    for (let i = 1; i <= 8; i++) {
      expect(shortcuts).toContain(String(i));
    }
  });

  it('all 10 views have unique ids', () => {
    const views = getAllViews();
    const ids = views.map(v => v.id);
    expect(new Set(ids).size).toBe(10);
  });
});
