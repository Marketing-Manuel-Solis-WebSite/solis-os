'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { getTasks, getDocuments, getMembers, getAuditLogs, getTeams, getChannels } from '@/lib/db';
import { getAIConversations } from '@/lib/ai-db';
import StatsDashboard from '@/components/analytics/stats-dashboard';
import AIAnalysisPanel from '@/components/analytics/ai-analysis-panel';
import {
  BarChart3, TrendingUp, Brain, ChevronRight, Sparkles, RefreshCw,
  Users, FileText, CheckSquare, MessageSquare, Activity, Zap
} from 'lucide-react';

export interface PlatformData {
  tasks: any[];
  docs: any[];
  members: any[];
  teams: any[];
  channels: any[];
  auditLogs: any[];
  aiConversations: any[];
  loadedAt: Date;
}

export default function AnalyticsPage() {
  const { user, me, isAdmin, teams } = useAuth();
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'ai'>('dashboard');
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    if (!user) return;
    try {
      const [tasks, docs, members, teamsList, channels, auditLogs, aiConvos] = await Promise.all([
        getTasks('__all__').catch(() => []),
        getDocuments('__all__').catch(() => []),
        getMembers().catch(() => []),
        getTeams().catch(() => []),
        getChannels('__all__').catch(() => []),
        getAuditLogs().catch(() => []),
        getAIConversations(user.uid).catch(() => []),
      ]);
      setData({
        tasks: tasks as any[],
        docs: docs as any[],
        members: members as any[],
        teams: teamsList as any[],
        channels: channels as any[],
        auditLogs: auditLogs as any[],
        aiConversations: aiConvos as any[],
        loadedAt: new Date(),
      });
    } catch (err) {
      console.error('Analytics load error:', err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Quick stats
  const stats = data ? {
    totalTasks: data.tasks.length,
    completedTasks: data.tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length,
    overdueTasks: data.tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'completed').length,
    totalDocs: data.docs.length,
    totalMembers: data.members.length,
    activeMembers: data.members.filter((m: any) => m.active !== false).length,
    totalChannels: data.channels.length,
    totalMessages: data.auditLogs.length,
    aiConversations: data.aiConversations.length,
    departments: data.teams.length,
  } : null;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 anim-slide">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                Analytics
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#D4A843]/10 to-purple-500/10 text-[#D4A843] border border-[#D4A843]/20 font-semibold">AI-POWERED</span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {data ? `Last updated: ${data.loadedAt.toLocaleTimeString()}` : 'Loading platform data...'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refresh} disabled={refreshing}
                className="flex items-center gap-2 px-4 h-9 rounded-xl border border-[#1F2937] text-sm text-gray-400 hover:text-gray-200 transition">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <div className="flex rounded-xl border border-[#1F2937]/60 overflow-hidden">
                <button onClick={() => setView('dashboard')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition ${view === 'dashboard' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-gray-400'}`}>
                  <BarChart3 className="h-3.5 w-3.5" /> Dashboard
                </button>
                <button onClick={() => setView('ai')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition ${view === 'ai' ? 'bg-purple-500/10 text-purple-400' : 'text-gray-600 hover:text-gray-400'}`}>
                  <Brain className="h-3.5 w-3.5" /> AI Analysis
                </button>
              </div>
            </div>
          </div>

          {/* Quick stats bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 anim-slide" style={{ animationDelay: '40ms' }}>
              {[
                { label: 'Tasks', value: stats.totalTasks, sub: `${stats.completedTasks} done`, icon: CheckSquare, color: '#22C55E' },
                { label: 'Documents', value: stats.totalDocs, sub: 'total', icon: FileText, color: '#3B82F6' },
                { label: 'Members', value: stats.activeMembers, sub: `of ${stats.totalMembers}`, icon: Users, color: '#D4A843' },
                { label: 'Channels', value: stats.totalChannels, sub: 'active', icon: MessageSquare, color: '#8B5CF6' },
                { label: 'Activity', value: stats.totalMessages, sub: 'events', icon: Activity, color: '#F59E0B' },
                { label: 'AI Chats', value: stats.aiConversations, sub: 'conversations', icon: Zap, color: '#EC4899' },
              ].map((s, i) => (
                <div key={s.label} className="p-4 rounded-2xl border border-[#1F2937]/60 bg-[#111827] card-hover anim-slide" style={{ animationDelay: `${(i + 2) * 40}ms` }}>
                  <div className="flex items-center justify-between mb-2">
                    <s.icon className="h-4 w-4" style={{ color: s.color }} />
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${s.color}10`, color: s.color }}>{s.sub}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-48 skeleton rounded-2xl" />)}</div>
          ) : !data ? (
            <div className="text-center py-20"><BarChart3 className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-600">Could not load data.</p></div>
          ) : (
            <>
              {view === 'dashboard' && <StatsDashboard data={data} />}
              {view === 'ai' && <AIAnalysisPanel data={data} userId={user?.uid || ''} userName={me?.displayName || ''} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}