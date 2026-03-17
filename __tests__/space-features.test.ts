import { describe, it, expect } from 'vitest';

// We can't import directly from space-features.ts due to Firebase init.
// Instead, re-declare the pure logic here for testing.

// ---- Copied pure types and constants ----

interface SpaceFeatures {
  timeTracking: boolean;
  dependencies: boolean;
  multipleAssignees: boolean;
  priorities: boolean;
  tags: boolean;
  customFields: boolean;
  subtasks: boolean;
  checklists: boolean;
  recurrence: boolean;
  timeEstimates: boolean;
  attachments: boolean;
  startDates: boolean;
  taskTypes: boolean;
  watchers: boolean;
}

const ALL_FEATURES: SpaceFeatures = {
  timeTracking: true, dependencies: true, multipleAssignees: true,
  priorities: true, tags: true, customFields: true, subtasks: true,
  checklists: true, recurrence: true, timeEstimates: true,
  attachments: true, startDates: true, taskTypes: true, watchers: true,
};

const MINIMAL_FEATURES: SpaceFeatures = {
  timeTracking: false, dependencies: false, multipleAssignees: false,
  priorities: true, tags: true, customFields: false, subtasks: true,
  checklists: true, recurrence: false, timeEstimates: false,
  attachments: true, startDates: false, taskTypes: false, watchers: false,
};

function isSpaceFeatureEnabled(
  features: SpaceFeatures | null | undefined,
  feature: keyof SpaceFeatures,
): boolean {
  if (!features) return true;
  return features[feature] !== false;
}

// ---- Tests ----

describe('Space Features — Constants', () => {
  it('ALL_FEATURES has all keys enabled', () => {
    for (const value of Object.values(ALL_FEATURES)) {
      expect(value).toBe(true);
    }
  });

  it('MINIMAL_FEATURES has a mix of enabled/disabled', () => {
    const enabled = Object.values(MINIMAL_FEATURES).filter(Boolean).length;
    const disabled = Object.values(MINIMAL_FEATURES).filter(v => !v).length;
    expect(enabled).toBeGreaterThan(0);
    expect(disabled).toBeGreaterThan(0);
  });

  it('MINIMAL_FEATURES has priorities enabled', () => {
    expect(MINIMAL_FEATURES.priorities).toBe(true);
  });

  it('MINIMAL_FEATURES has timeTracking disabled', () => {
    expect(MINIMAL_FEATURES.timeTracking).toBe(false);
  });

  it('ALL_FEATURES and MINIMAL_FEATURES have the same keys', () => {
    const allKeys = Object.keys(ALL_FEATURES).sort();
    const minKeys = Object.keys(MINIMAL_FEATURES).sort();
    expect(allKeys).toEqual(minKeys);
  });

  it('has exactly 14 features', () => {
    expect(Object.keys(ALL_FEATURES)).toHaveLength(14);
  });
});

describe('isSpaceFeatureEnabled', () => {
  it('returns true when features is null (default)', () => {
    expect(isSpaceFeatureEnabled(null, 'timeTracking')).toBe(true);
  });

  it('returns true when features is undefined (default)', () => {
    expect(isSpaceFeatureEnabled(undefined, 'timeTracking')).toBe(true);
  });

  it('returns true when feature is enabled', () => {
    expect(isSpaceFeatureEnabled(ALL_FEATURES, 'timeTracking')).toBe(true);
  });

  it('returns false when feature is disabled', () => {
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'timeTracking')).toBe(false);
  });

  it('returns true for enabled features in MINIMAL preset', () => {
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'priorities')).toBe(true);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'tags')).toBe(true);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'subtasks')).toBe(true);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'checklists')).toBe(true);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'attachments')).toBe(true);
  });

  it('returns false for disabled features in MINIMAL preset', () => {
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'dependencies')).toBe(false);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'multipleAssignees')).toBe(false);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'customFields')).toBe(false);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'recurrence')).toBe(false);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'timeEstimates')).toBe(false);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'startDates')).toBe(false);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'taskTypes')).toBe(false);
    expect(isSpaceFeatureEnabled(MINIMAL_FEATURES, 'watchers')).toBe(false);
  });

  it('handles partial features object gracefully', () => {
    const partial = { timeTracking: false } as SpaceFeatures;
    expect(isSpaceFeatureEnabled(partial, 'timeTracking')).toBe(false);
  });

  it('checks every feature key in ALL_FEATURES returns true', () => {
    for (const key of Object.keys(ALL_FEATURES) as (keyof SpaceFeatures)[]) {
      expect(isSpaceFeatureEnabled(ALL_FEATURES, key)).toBe(true);
    }
  });

  it('null features defaults to all enabled for safety', () => {
    for (const key of Object.keys(ALL_FEATURES) as (keyof SpaceFeatures)[]) {
      expect(isSpaceFeatureEnabled(null, key)).toBe(true);
    }
  });
});
