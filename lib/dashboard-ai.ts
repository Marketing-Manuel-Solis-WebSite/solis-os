// Dashboard AI — calls /api/ai with dashboard metrics
import { auth } from './firebase';

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
  const question = `Eres un asistente de productividad. Analiza estas métricas y da un resumen breve y directo.

DATOS:
- Tareas totales: ${metrics.totalTasks}
- Completadas: ${metrics.completedTasks} (${metrics.completionRate}%)
- En progreso: ${metrics.inProgressTasks}
- Vencidas: ${metrics.overdueTasks}
- Metas: ${metrics.totalGoals} (${metrics.goalsAtRisk} en riesgo)
- Equipo: ${metrics.teamName || 'General'}

REGLAS:
- Responde en texto plano, como si fueras ChatGPT respondiendo casualmente
- Maximo 4-5 oraciones cortas
- No uses emojis, ni markdown, ni negritas, ni asteriscos, ni bullets, ni guiones
- No uses títulos ni encabezados
- Sé directo, claro y actionable
- Responde en español`;

  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ question, mode: 'chat', history: [], stream: false }),
  });

  if (!res.ok) throw new Error('AI request failed');
  const data = await res.json();
  return data.answer || '';
}
