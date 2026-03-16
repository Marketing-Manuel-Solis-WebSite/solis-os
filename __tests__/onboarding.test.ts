import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

vi.mock('@/lib/org', () => ({
  getCurrentOrgId: () => 'test-org',
  ORG_ID: 'test-org',
}));

import {
  getOnboardingProgress,
  getCurrentStepName,
  STEP_COUNT,
  type OnboardingState,
} from '../lib/onboarding';

const makeState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  completed: false,
  currentStep: 0,
  steps: {
    welcome: false,
    createSpace: false,
    inviteMembers: false,
    createFirstTask: false,
    exploreViews: false,
  },
  skipped: false,
  ...overrides,
});

describe('getOnboardingProgress', () => {
  it('returns 0% for fresh state', () => {
    expect(getOnboardingProgress(makeState())).toBe(0);
  });

  it('returns 20% for 1 of 5 steps done', () => {
    expect(getOnboardingProgress(makeState({ steps: { welcome: true, createSpace: false, inviteMembers: false, createFirstTask: false, exploreViews: false } }))).toBe(20);
  });

  it('returns 60% for 3 of 5 steps done', () => {
    expect(getOnboardingProgress(makeState({
      steps: { welcome: true, createSpace: true, inviteMembers: true, createFirstTask: false, exploreViews: false },
    }))).toBe(60);
  });

  it('returns 100% for all steps done', () => {
    expect(getOnboardingProgress(makeState({
      steps: { welcome: true, createSpace: true, inviteMembers: true, createFirstTask: true, exploreViews: true },
    }))).toBe(100);
  });
});

describe('getCurrentStepName', () => {
  it('returns welcome for fresh state', () => {
    expect(getCurrentStepName(makeState())).toBe('welcome');
  });

  it('returns createSpace when welcome is done', () => {
    expect(getCurrentStepName(makeState({ currentStep: 1, steps: { welcome: true, createSpace: false, inviteMembers: false, createFirstTask: false, exploreViews: false } }))).toBe('createSpace');
  });

  it('returns null when completed', () => {
    expect(getCurrentStepName(makeState({ completed: true }))).toBe(null);
  });
});

describe('STEP_COUNT', () => {
  it('is 5', () => {
    expect(STEP_COUNT).toBe(5);
  });
});
