// ================================================================
// Goal Check-ins — Periodic progress updates & commentary
// ================================================================
// Enables team members to submit regular check-ins on goals,
// recording confidence, blockers, and next steps.

import {
  collection, doc, addDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export type ConfidenceLevel = 'on_track' | 'at_risk' | 'off_track';

export interface GoalCheckin {
  id: string;
  goalId: string;
  orgId: string;
  authorId: string;
  authorName: string;
  confidence: ConfidenceLevel;
  progressSnapshot: number;   // progress % at time of check-in
  statusSnapshot: string;     // goal status at time of check-in
  summary: string;            // what happened since last check-in
  blockers: string;           // current blockers
  nextSteps: string;          // planned next steps
  metrics: CheckinMetric[];   // optional numeric metrics
  createdAt: any;
  updatedAt: any;
}

export interface CheckinMetric {
  label: string;
  value: number;
  unit: string;
  previousValue?: number;
}

export interface CheckinSchedule {
  goalId: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number;   // 0=Sun, 1=Mon, ... (for weekly/biweekly)
  dayOfMonth?: number;  // 1-28 (for monthly)
  assignedTo: string[]; // user IDs who should submit check-ins
  active: boolean;
}

// ---- CRUD ----

export async function createCheckin(goalId: string, data: {
  authorId: string;
  authorName: string;
  confidence: ConfidenceLevel;
  progressSnapshot: number;
  statusSnapshot: string;
  summary: string;
  blockers?: string;
  nextSteps?: string;
  metrics?: CheckinMetric[];
}): Promise<string> {
  const ref = await addDoc(collection(db, `goals/${goalId}/checkins`), {
    goalId,
    orgId: ORG,
    authorId: data.authorId,
    authorName: data.authorName,
    confidence: data.confidence,
    progressSnapshot: data.progressSnapshot,
    statusSnapshot: data.statusSnapshot,
    summary: data.summary,
    blockers: data.blockers || '',
    nextSteps: data.nextSteps || '',
    metrics: data.metrics || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCheckins(
  goalId: string,
  maxResults = 50,
): Promise<GoalCheckin[]> {
  const q = query(
    collection(db, `goals/${goalId}/checkins`),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as GoalCheckin));
}

export async function getLatestCheckin(goalId: string): Promise<GoalCheckin | null> {
  const results = await getCheckins(goalId, 1);
  return results[0] || null;
}

export async function updateCheckin(
  goalId: string,
  checkinId: string,
  data: Partial<Pick<GoalCheckin, 'summary' | 'blockers' | 'nextSteps' | 'confidence' | 'metrics'>>,
): Promise<void> {
  await updateDoc(doc(db, `goals/${goalId}/checkins/${checkinId}`), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCheckin(goalId: string, checkinId: string): Promise<void> {
  await deleteDoc(doc(db, `goals/${goalId}/checkins/${checkinId}`));
}

// ---- Check-in Schedule ----

export async function getCheckinSchedule(goalId: string): Promise<CheckinSchedule | null> {
  const q = query(
    collection(db, `goals/${goalId}/settings`),
    where('type', '==', 'checkin_schedule'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as CheckinSchedule;
}

export async function saveCheckinSchedule(goalId: string, schedule: Omit<CheckinSchedule, 'goalId'>): Promise<void> {
  const existing = await getCheckinSchedule(goalId);
  const data = { ...schedule, goalId, type: 'checkin_schedule' };

  if (existing) {
    // Find the doc and update
    const q = query(
      collection(db, `goals/${goalId}/settings`),
      where('type', '==', 'checkin_schedule'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, { ...data, updatedAt: serverTimestamp() });
      return;
    }
  }

  await addDoc(collection(db, `goals/${goalId}/settings`), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ---- Check-in Analytics ----

/**
 * Compute check-in streak and summary stats for a goal.
 */
export async function getCheckinStats(goalId: string): Promise<{
  totalCheckins: number;
  streak: number;
  lastCheckinDate: string | null;
  avgConfidence: number;
  confidenceDistribution: Record<ConfidenceLevel, number>;
}> {
  const checkins = await getCheckins(goalId, 200);

  if (checkins.length === 0) {
    return {
      totalCheckins: 0,
      streak: 0,
      lastCheckinDate: null,
      avgConfidence: 0,
      confidenceDistribution: { on_track: 0, at_risk: 0, off_track: 0 },
    };
  }

  // Confidence distribution
  const dist: Record<ConfidenceLevel, number> = { on_track: 0, at_risk: 0, off_track: 0 };
  for (const c of checkins) {
    if (dist[c.confidence] !== undefined) dist[c.confidence]++;
  }

  // Average confidence as numeric (on_track=3, at_risk=2, off_track=1)
  const confMap: Record<ConfidenceLevel, number> = { on_track: 3, at_risk: 2, off_track: 1 };
  const avgConfidence = Math.round(
    (checkins.reduce((s, c) => s + (confMap[c.confidence] || 2), 0) / checkins.length) * 10,
  ) / 10;

  // Streak: count consecutive weeks with at least one check-in
  let streak = 0;
  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  let weekStart = new Date(now.getTime() - weekMs);
  weekStart.setHours(0, 0, 0, 0);

  const checkinDates = checkins
    .map(c => c.createdAt?.toDate?.() || (c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null))
    .filter(Boolean) as Date[];

  for (let w = 0; w < 52; w++) {
    const wStart = new Date(now.getTime() - (w + 1) * weekMs);
    const wEnd = new Date(now.getTime() - w * weekMs);
    const hasCheckin = checkinDates.some(d => d >= wStart && d < wEnd);
    if (hasCheckin) {
      streak++;
    } else if (w > 0) {
      break; // streak broken
    }
  }

  const lastDate = checkinDates[0];
  const lastCheckinDate = lastDate ? lastDate.toISOString().split('T')[0] : null;

  return {
    totalCheckins: checkins.length,
    streak,
    lastCheckinDate,
    avgConfidence,
    confidenceDistribution: dist,
  };
}
