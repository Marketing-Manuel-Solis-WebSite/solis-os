'use client';
import { useState, useRef, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { sanitizeHtml } from '@/lib/sanitize-html';
import type { AnalyticsSnapshot } from '@/app/app/analytics/page';
import { checkAIUsage, incrementAIUsage, logAIAction } from '@/lib/ai-usage';
import {
  Brain, Send, Loader2, Copy, Check, Sparkles, TrendingUp, Target, Globe,
  FileText, Users, BarChart3, Shield, Lightbulb, Zap, ArrowRight, ChevronDown,
  Building2, RefreshCw, BookOpen, Scale, AlertTriangle, CheckSquare
} from 'lucide-react';

interface Props {
  data: AnalyticsSnapshot;
  userId: string;
  userName: string;
  userRole: string;
}

interface Analysis {
  id: string;
  type: string;
  question: string;
  answer: string;
  timestamp: Date;
}

// Pre-built analysis templates
const ANALYSIS_CATEGORIES = [
  {
    id: 'performance',
    label: 'Performance',
    emoji: '\ud83d\udcca',
    color: '#3B82F6',
    analyses: [
      { id: 'overall', icon: TrendingUp, label: 'Overall Performance Report', prompt: 'Generate a comprehensive performance analysis of the entire organization. Cover task completion rates, productivity metrics, department comparisons, and identify strengths and weaknesses. Include specific recommendations for improvement.' },
      { id: 'bottlenecks', icon: AlertTriangle, label: 'Identify Bottlenecks', prompt: 'Analyze the workflow data and identify all bottlenecks, blockers, and inefficiencies across departments. Which teams are overloaded? Where are tasks getting stuck? What processes need improvement?' },
      { id: 'kpis', icon: Target, label: 'KPI Analysis', prompt: 'Based on the data, calculate and analyze the most important KPIs for this law firm: task completion rate, average task duration, document production rate, team utilization, and any other relevant metrics. Compare departments and provide benchmarks.' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    emoji: '\ud83d\udc65',
    color: '#3B82F6',
    analyses: [
      { id: 'workload', icon: Users, label: 'Workload Distribution', prompt: 'Analyze the workload distribution across all team members and departments. Who is overloaded? Who has capacity? Recommend optimal task redistribution.' },
      { id: 'structure', icon: Building2, label: 'Org Structure Review', prompt: 'Review the organizational structure, department composition, and role distribution. Is the team well-balanced? Are there gaps in skills or coverage? Recommend structural improvements.' },
      { id: 'productivity', icon: Zap, label: 'Team Productivity', prompt: 'Analyze team productivity by measuring output per person per department. Which teams are most productive? What factors might be affecting lower-performing teams? Include actionable recommendations.' },
    ],
  },
  {
    id: 'market',
    label: 'Market',
    emoji: '\ud83c\udf10',
    color: '#A855F7',
    analyses: [
      { id: 'competitive', icon: Globe, label: 'Competitive Analysis', prompt: 'Provide a comprehensive competitive analysis for an immigration law firm like ours. What are the top competitors doing differently? What market trends should we be aware of? What strategies can help us gain market share?' },
      { id: 'marketing', icon: Target, label: 'Marketing Strategy', prompt: 'Based on our team structure (Marketing, Openers, Closers, Direccion departments), analyze our marketing funnel and recommend improvements. Cover digital marketing, social media, lead generation, and conversion optimization for an immigration law firm.' },
      { id: 'growth', icon: TrendingUp, label: 'Growth Opportunities', prompt: 'Identify growth opportunities for our immigration law firm. Consider new service areas, geographic expansion, technology adoption, partnership opportunities, and client acquisition strategies.' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    emoji: '\u2699\ufe0f',
    color: '#22C55E',
    analyses: [
      { id: 'processes', icon: RefreshCw, label: 'Process Improvement', prompt: 'Analyze our operational processes based on task and document data. Identify areas for automation, standardization, and efficiency gains. Recommend specific process improvements for each department.' },
      { id: 'compliance', icon: Shield, label: 'Compliance & Risk', prompt: 'Review our operational data for compliance risks, security concerns, and operational vulnerabilities. What areas need immediate attention? What policies or procedures should be implemented or improved?' },
      { id: 'technology', icon: Lightbulb, label: 'Tech Recommendations', prompt: 'Based on our current platform usage and team workflows, recommend technology improvements, integrations, and tools that could increase efficiency. Consider AI automation, document management, client communication, and case management.' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    emoji: '\ud83d\udcc4',
    color: '#F59E0B',
    analyses: [
      { id: 'doc-review', icon: FileText, label: 'Document Portfolio Review', prompt: 'Review the entire document portfolio. What types of documents do we have? Are there gaps in our documentation? Which departments produce the most content? Recommend documents that should be created or improved.' },
      { id: 'templates', icon: BookOpen, label: 'Template Recommendations', prompt: 'Based on the types of documents we create and our immigration law focus, recommend standard templates and SOPs we should have. Include meeting notes, case intake forms, legal briefs, client communications, and operational procedures.' },
      { id: 'quality', icon: Scale, label: 'Content Quality', prompt: 'Analyze the quality of our document output based on word counts, categories, and organization. Are documents well-organized? What standards should we implement for document creation and management?' },
    ],
  },
];

export default function AIAnalysisPanel({ data, userId, userName, userRole }: Props) {
  const { t } = useI18n();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState('');
  const [customQ, setCustomQ] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('performance');
  const [usageError, setUsageError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analyses.length]);

  // Build platform context from pre-computed snapshot (NOT raw arrays)
  const buildContext = () => {
    const deptSummaries = data.departments.map(dept => {
      const dm = data.deptMetrics[dept.id] || { tasks: 0, completed: 0, rate: 0, docs: 0, members: 0, words: 0 };
      return `- ${dept.name} (${dept.icon}): ${dm.members} members, ${dm.tasks} tasks (${dm.completed} completed, ${dm.rate}% rate), ${dm.docs} documents (${dm.words.toLocaleString()} words)`;
    }).join('\n');

    const statusStr = Object.entries(data.tasksByStatus).map(([s, c]) => `${s}: ${c}`).join(', ');
    const prioStr = Object.entries(data.tasksByPriority).map(([p, c]) => `${p}: ${c}`).join(', ');
    const roleStr = Object.entries(data.membersByRole).map(([r, c]) => `${r}: ${c}`).join(', ');
    const docList = data.topDocuments.map(d => `"${d.title}" (${d.wordCount} words, ${d.visibility}, ${d.teamName})`).join('\n  ');

    let deptContext = '';
    if (selectedDept !== 'all') {
      const dept = data.departments.find(d => d.id === selectedDept);
      const dm = data.deptMetrics[selectedDept];
      if (dept && dm) {
        deptContext = `\n\n--- FOCUSED DEPARTMENT: ${dept.name} ---
Tasks: ${dm.tasks} total, ${dm.completed} completed (${dm.rate}%)
Documents: ${dm.docs} (${dm.words.toLocaleString()} words)
Members: ${dm.members}`;
      }
    }

    return `
=== SOLIS CENTER — PLATFORM DATA CONTEXT ===
Organization: Law Office of Manuel Solis (Immigration Law)
Platform: Solis Center (Internal workspace with tasks, docs, chat, AI)
Analysis Date: ${new Date(data.computedAt).toLocaleDateString()}
Analyzed by: ${userName}

--- SUMMARY ---
Total Members: ${data.totalMembers} (Active: ${data.activeMembers}, Roles: ${roleStr})
Total Tasks: ${data.totalTasks} (Completed: ${data.completedTasks}, Overdue: ${data.overdueTasks}, Rate: ${data.completionRate}%)
Total Documents: ${data.totalDocs} (Total words: ${data.totalWords.toLocaleString()})
Total Goals: ${data.totalGoals} (At risk: ${data.goalsAtRisk}, Avg progress: ${data.avgGoalProgress}%)
Departments: ${data.departments.length}
Channels: ${data.totalChannels}
AI Conversations: ${data.aiConversationsTotal}
Actions (7d): ${data.actionsLast7d} | Actions (30d): ${data.actionsLast30d}
Hours logged (7d): ${data.totalHoursLast7d}h | Hours (30d): ${data.totalHoursLast30d}h
Billable hours (30d): ${data.billableHoursLast30d}h | Non-billable: ${data.nonBillableHoursLast30d}h

--- TASK BREAKDOWN ---
By Status: ${statusStr}
By Priority: ${prioStr}
Tasks created (7d): ${data.createdLast7d} | Completed (7d): ${data.completedLast7d}
Tasks created (30d): ${data.createdLast30d} | Completed (30d): ${data.completedLast30d}

--- DEPARTMENT DETAILS ---
${deptSummaries}

--- TOP DOCUMENTS ---
  ${docList || 'No documents yet'}
${deptContext}
=== END CONTEXT ===
`;
  };

  const runAnalysis = async (question: string, type: string = 'custom') => {
    setUsageError('');

    // Check AI usage before sending
    try {
      const usage = await checkAIUsage(userId, userRole, 'research');
      if (!usage.allowed) {
        setUsageError(`Limite diario alcanzado (${usage.used}/${usage.limit} unidades). Intenta manana.`);
        return;
      }
    } catch {}

    setLoading(true);
    setCurrentQ(question);
    const start = Date.now();

    try {
      const context = buildContext();
      const fullPrompt = `${context}\n\n--- ANALYSIS REQUEST ---\n${question}\n\nProvide a thorough, data-driven analysis based on the platform data above. Use specific numbers, percentages, and comparisons. Include clear recommendations. Format with markdown headers, bullet points, and tables where appropriate.`;

      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({
          question: fullPrompt,
          mode: 'research',
          feature: 'analytics',
        }),
      });

      const result = await res.json();
      const durationMs = Date.now() - start;

      if (!res.ok) {
        // Surface classified error from API
        const code = result.code || '';
        let errorMsg = result.error || 'AI processing failed';
        if (code === 'RATE_LIMIT') errorMsg = 'Limite de API excedido. Espera un minuto e intenta de nuevo.';
        else if (code === 'TIMEOUT') errorMsg = 'La consulta tardo demasiado. Intenta con una pregunta mas corta.';
        else if (code === 'AUTH_FAILED') errorMsg = 'Error de autenticacion con el servicio AI. Contacta al admin.';

        setAnalyses(prev => [...prev, {
          id: `a-${Date.now()}`, type: 'error', question,
          answer: `Error: ${errorMsg}`, timestamp: new Date(),
        }]);

        logAIAction({
          userId, userName, feature: 'analytics', mode: 'research',
          questionLength: question.length, contextLength: fullPrompt.length,
          responseLength: 0, truncated: false, durationMs,
          success: false, error: errorMsg, estimatedTokens: 0,
        }).catch(() => { /* best-effort tracking */ });
      } else {
        const answer = result.answer || 'No response from AI.';

        setAnalyses(prev => [...prev, {
          id: `a-${Date.now()}`, type, question, answer, timestamp: new Date(),
        }]);

        // Increment usage + log
        const tokens = result.usage?.estimatedInputTokens + result.usage?.estimatedOutputTokens || 0;
        incrementAIUsage(userId, 'research', tokens).catch(() => { /* best-effort tracking */ });
        logAIAction({
          userId, userName, feature: 'analytics', mode: 'research',
          questionLength: question.length, contextLength: fullPrompt.length,
          responseLength: answer.length, truncated: result.truncated || false,
          durationMs, success: true, estimatedTokens: tokens,
        }).catch(() => { /* best-effort tracking */ });
      }
    } catch (err: any) {
      setAnalyses(prev => [...prev, {
        id: `a-${Date.now()}`, type: 'error', question,
        answer: `Error: ${err.message || 'Failed to connect to AI'}`,
        timestamp: new Date(),
      }]);
    }

    setLoading(false);
    setCurrentQ('');
  };

  const handleCustom = () => {
    if (!customQ.trim()) return;
    runAnalysis(customQ.trim());
    setCustomQ('');
  };

  const copyResult = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // URL validation — reject javascript:/data:/vbscript: protocols
  const isSafeUrl = (url: string): boolean => {
    const lower = url.toLowerCase().trim();
    if (/^(javascript|data|vbscript|file):/i.test(lower)) return false;
    return /^(https?:\/\/|mailto:|tel:|\/|#|\.)/.test(lower) || !/^[a-z]+:/i.test(lower);
  };

  // Markdown renderer (simplified) — HTML is escaped first to prevent XSS
  const renderMd = (text: string): string => {
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return safe
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
      .replace(/^#### (.+)$/gm, '<h4 class="ai-h4">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="ai-bold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^&gt; (.+)$/gm, '<blockquote class="ai-blockquote">$1</blockquote>')
      .replace(/^---$/gm, '<hr class="ai-hr" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m: string, txt: string, href: string) =>
        isSafeUrl(href) ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${txt}</a>` : `<span>${txt}</span>`)
      .replace(/^\|(.+)\|$/gm, (match) => {
        const cells = match.split('|').filter(Boolean).map(c => c.trim());
        if (cells.every(c => /^[-:]+$/.test(c))) return '';
        return '<tr>' + cells.map(c => `<td class="ai-td">${c}</td>`).join('') + '</tr>';
      })
      .replace(/^[-*] (.+)$/gm, '<li class="ai-li">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ai-li-num">$1</li>')
      .replace(/(<li class="ai-li">.+?<\/li>\n?)+/g, '<ul class="ai-ul">$&</ul>')
      .replace(/(<li class="ai-li-num">.+?<\/li>\n?)+/g, '<ol class="ai-ol">$&</ol>')
      .replace(/(<tr>.+?<\/tr>\n?)+/g, '<table class="ai-table">$&</table>')
      .replace(/^(?!<[hbluptd]|<li|<pre|<code|<hr|<tr|<blockquote|<ul|<ol|<table)(.+)$/gm, '<p class="ai-p">$1</p>');
  };

  return (
    <div className="space-y-6">
      {/* Usage warning */}
      {usageError && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-[13px] text-amber-300">{usageError}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap anim-slide" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-[var(--text-secondary)]">Focus:</span>
        </div>
        <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="select-dark h-8 text-sm">
          <option value="all">All Departments</option>
          {data.departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
        </select>
        {selectedDept !== 'all' && (
          <button onClick={() => setSelectedDept('all')} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Clear filter</button>
        )}
      </div>

      {/* Analysis categories */}
      <div className="space-y-2 anim-slide" style={{ animationDelay: '120ms' }}>
        {ANALYSIS_CATEGORIES.map(cat => (
          <div key={cat.id} className="rounded-xl shadow-card bg-[var(--bg-elevated)] overflow-hidden">
            <button onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.01] transition">
              <span className="text-lg">{cat.emoji}</span>
              <span className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</span>
              <span className="text-[12px] text-[var(--text-muted)] ml-2">{cat.analyses.length} analyses</span>
              <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] ml-auto transition-transform ${expandedCategory === cat.id ? 'rotate-180' : ''}`} />
            </button>
            {expandedCategory === cat.id && (
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
                {cat.analyses.map(a => (
                  <button key={a.id} onClick={() => runAnalysis(a.prompt, a.id)} disabled={loading}
                    className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] text-left transition-all duration-200 group disabled:opacity-50">
                    <a.icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: cat.color }} />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition">{a.label}</p>
                      <p className="text-[12px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{a.prompt.slice(0, 80)}...</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Custom query */}
      <div className="rounded-xl bg-purple-500/[0.03] p-5 anim-slide" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-bold text-purple-400">Custom Analysis</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">Server-computed context</span>
        </div>
        <div className="flex gap-2">
          <textarea value={customQ} onChange={e => setCustomQ(e.target.value)} placeholder="Ask anything about your organization, team, market, operations, documents..."
            rows={2} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] text-sm text-gray-200 placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-purple-500/30 resize-none disabled:opacity-50"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCustom(); } }} />
          <button onClick={handleCustom} disabled={loading || !customQ.trim()}
            className="h-[52px] px-5 rounded-xl bg-purple-500/15 text-purple-400 text-sm font-semibold flex items-center gap-2 hover:bg-purple-500/25 transition-all duration-200 disabled:opacity-30 shrink-0">
            <Send className="h-4 w-4" /> {t('aiAnalysis.analyze')}
          </button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {[
            'Como podemos mejorar la productividad del equipo?',
            'What are our biggest risks right now?',
            'Analiza nuestra estrategia de marketing vs competidores',
            'Recommend process automations',
          ].map((q, i) => (
            <button key={i} onClick={() => { setCustomQ(q); }} className="text-[12px] px-2 py-1 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all duration-200">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {analyses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
            Analysis Results ({analyses.length})
          </h3>
          {analyses.map((a) => (
            <div key={a.id} className="rounded-xl shadow-card bg-[var(--bg-base)] overflow-hidden anim-fade">
              <div className="px-5 py-3 bg-[#0A0E16] flex items-center gap-3">
                <Brain className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-secondary)] truncate">{a.question.slice(0, 120)}</p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{a.timestamp.toLocaleTimeString()}</p>
                </div>
                <button onClick={() => copyResult(a.answer, a.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition shrink-0">
                  {copiedId === a.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedId === a.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="p-5 ai-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(a.answer)) }} />
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl bg-purple-500/[0.03] p-6 flex items-center gap-4 anim-fade">
          <Loader2 className="h-5 w-5 text-purple-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm text-purple-400 font-semibold">Analyzing platform data...</p>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{currentQ.slice(0, 80)}{currentQ.length > 80 ? '...' : ''}</p>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
