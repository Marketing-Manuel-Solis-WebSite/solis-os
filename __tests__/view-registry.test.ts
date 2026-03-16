import { describe, it, expect, beforeEach } from 'vitest';

// These are pure functions with no Firebase dependency
import { registerView, getView, getAllViews, hasView, type ViewEntry, type ViewProps } from '../lib/views';

// Dummy component for registration
const DummyView = (() => null) as unknown as React.ComponentType<ViewProps>;

const mockEntry: ViewEntry = {
  id: 'test-view',
  name: 'Test View',
  nameEs: 'Vista Test',
  iconName: 'LayoutList',
  shortcut: '9',
  component: DummyView,
  capabilities: {
    groupBy: true,
    sort: true,
    filter: true,
    density: false,
    columns: false,
    bulkSelect: false,
    calendarMode: false,
  },
};

describe('View Registry', () => {
  it('registers and retrieves a view', () => {
    registerView(mockEntry);
    expect(hasView('test-view')).toBe(true);
    expect(getView('test-view')?.name).toBe('Test View');
  });

  it('getAllViews includes registered views', () => {
    const all = getAllViews();
    expect(all.some(v => v.id === 'test-view')).toBe(true);
  });

  it('returns undefined for unknown view', () => {
    expect(getView('nonexistent')).toBeUndefined();
    expect(hasView('nonexistent')).toBe(false);
  });

  it('overwrites view with same id', () => {
    registerView({ ...mockEntry, name: 'Updated' });
    expect(getView('test-view')?.name).toBe('Updated');
  });
});
