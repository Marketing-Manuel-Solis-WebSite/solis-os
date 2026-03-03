export interface TimeEntry {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  taskId: string;
  taskTitle: string;
  date: string; // YYYY-MM-DD
  hours: number;
  minutes: number;
  notes: string;
  billable: boolean;
  teamId: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface WeekDay {
  date: string; // YYYY-MM-DD
  dayName: string;
  dayNum: number;
  isToday: boolean;
}

export function getWeekDates(offset: number = 0): WeekDay[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const days: WeekDay[] = [];
  const dayKeys = ['timesheets.mon', 'timesheets.tue', 'timesheets.wed', 'timesheets.thu', 'timesheets.fri', 'timesheets.sat', 'timesheets.sun'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const todayStr = new Date().toISOString().split('T')[0];
    days.push({
      date: d.toISOString().split('T')[0],
      dayName: dayKeys[i],
      dayNum: d.getDate(),
      isToday: d.toISOString().split('T')[0] === todayStr,
    });
  }
  return days;
}

export function formatDuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return '—';
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function totalMinutes(entries: { hours: number; minutes: number }[]): number {
  return entries.reduce((sum, e) => sum + (e.hours || 0) * 60 + (e.minutes || 0), 0);
}

export function minutesToDisplay(mins: number): { hours: number; minutes: number } {
  return { hours: Math.floor(mins / 60), minutes: mins % 60 };
}
