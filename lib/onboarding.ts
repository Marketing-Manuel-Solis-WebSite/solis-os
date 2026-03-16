// ============================================================
// Onboarding State Management — Tracks new user progress
// through the getting-started wizard.
// ============================================================

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId } from '@/lib/org';

export interface OnboardingSteps {
  welcome: boolean;
  createSpace: boolean;
  inviteMembers: boolean;
  createFirstTask: boolean;
  exploreViews: boolean;
}

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  steps: OnboardingSteps;
  skipped: boolean;
  completedAt?: any;
  startedAt?: any;
}

const STEP_ORDER: (keyof OnboardingSteps)[] = [
  'welcome',
  'createSpace',
  'inviteMembers',
  'createFirstTask',
  'exploreViews',
];

export const STEP_COUNT = STEP_ORDER.length;

function prefsPath(userId: string) {
  return `orgs/${getCurrentOrgId()}/members/${userId}/preferences/onboarding`;
}

const DEFAULT_STATE: OnboardingState = {
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
};

/**
 * Get onboarding state for a user.
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  try {
    const ref = doc(db, prefsPath(userId));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...DEFAULT_STATE, ...snap.data() } as OnboardingState;
    }
    return { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Initialize onboarding for a new user.
 */
export async function initOnboarding(userId: string): Promise<void> {
  const ref = doc(db, prefsPath(userId));
  await setDoc(ref, {
    ...DEFAULT_STATE,
    startedAt: serverTimestamp(),
  });
}

/**
 * Mark a step as complete and advance to next.
 */
export async function completeOnboardingStep(
  userId: string,
  step: keyof OnboardingSteps,
): Promise<OnboardingState> {
  const state = await getOnboardingState(userId);
  state.steps[step] = true;

  // Calculate current step (first incomplete)
  const nextIncomplete = STEP_ORDER.findIndex(s => !state.steps[s]);
  state.currentStep = nextIncomplete === -1 ? STEP_ORDER.length : nextIncomplete;

  // Check if all done
  const allDone = STEP_ORDER.every(s => state.steps[s]);
  if (allDone) {
    state.completed = true;
  }

  const ref = doc(db, prefsPath(userId));
  await updateDoc(ref, {
    steps: state.steps,
    currentStep: state.currentStep,
    completed: state.completed,
    ...(state.completed ? { completedAt: serverTimestamp() } : {}),
  });

  return state;
}

/**
 * Skip onboarding entirely.
 */
export async function skipOnboarding(userId: string): Promise<void> {
  const ref = doc(db, prefsPath(userId));
  await setDoc(ref, {
    ...DEFAULT_STATE,
    completed: true,
    skipped: true,
    completedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Check if onboarding should be shown (not completed and not skipped).
 */
export async function shouldShowOnboarding(userId: string): Promise<boolean> {
  const state = await getOnboardingState(userId);
  return !state.completed && !state.skipped;
}

/**
 * Get progress percentage.
 */
export function getOnboardingProgress(state: OnboardingState): number {
  const done = STEP_ORDER.filter(s => state.steps[s]).length;
  return Math.round((done / STEP_ORDER.length) * 100);
}

/**
 * Get the current step name.
 */
export function getCurrentStepName(state: OnboardingState): keyof OnboardingSteps | null {
  if (state.completed) return null;
  return STEP_ORDER[state.currentStep] || null;
}
