// Dashboard AI — calls /api/ai with dashboard metrics
import { auth } from './firebase';
import { promptAnalyticsInsight } from './ai-prompts';

export interface DashboardMetrics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  inProgressTasks: number;
  completionRate: number;
  goalsAtRisk: number;
  totalGoals: number;
  teamName: string;
  userName: string;
}

export async function generateDashboardInsights(metrics: DashboardMetrics): Promise<string> {
  // Use centralized prompt from ai-prompts.ts
  const question = promptAnalyticsInsight(metrics);

  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ question, mode: 'chat', history: [], stream: false, feature: 'dashboard' }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const code = data.code || '';
    if (code === 'RATE_LIMIT') throw new Error('RATE_LIMIT');
    if (code === 'TIMEOUT') throw new Error('TIMEOUT');
    throw new Error(data.error || 'AI request failed');
  }
  const data = await res.json();
  return data.answer || '';
}
