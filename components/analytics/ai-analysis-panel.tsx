'use client';
import { useState, useRef, useEffect } from 'react';
import type { PlatformData } from '@/app/app/analytics/page';
import {
  Brain, Send, Loader2, Copy, Check, Sparkles, TrendingUp, Target, Globe,
  FileText, Users, BarChart3, Shield, Lightbulb, Zap, ArrowRight, ChevronDown,
  Building2, RefreshCw, BookOpen, Scale, AlertTriangle, CheckSquare
} from 'lucide-react';

interface Props {
  data: PlatformData;
  userId: string;
  userName: string;
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
    label: '📊 Performance',
    color: '#D4A843',
    analyses: [
      { id: 'overall', icon: TrendingUp, label: 'Overall Performance Report', prompt: 'Generate a comprehensive performance analysis of the entire organization. Cover task completion rates, productivity metrics, department comparisons, and identify strengths and weaknesses. Include specific recommendations for improvement.' },
      { id: 'bottlenecks', icon: AlertTriangle, label: 'Identify Bottlenecks', prompt: 'Analyze the workflow data and identify all bottlenecks, blockers, and inefficiencies across departments. Which teams are overloaded? Where are tasks getting stuck? What processes need improvement?' },
      { id: 'kpis', icon: Target, label: 'KPI Analysis', prompt: 'Based on the data, calculate and analyze the most important KPIs for this law firm: task completion rate, average task duration, document production rate, team utilization, and any other relevant metrics. Compare departments and provide benchmarks.' },
    ],
  },
  {
    id: 'team',
    label: '👥 Team',
    color: '#3B82F6',
    analyses: [
      { id: 'workload', icon: Users, label: 'Workload Distribution', prompt: 'Analyze the workload distribution across all team members and departments. Who is overloaded? Who has capacity? Recommend optimal task redistribution.' },
      { id: 'structure', icon: Building2, label: 'Org Structure Review', prompt: 'Review the organizational structure, department composition, and role distribution. Is the team well-balanced? Are there gaps in skills or coverage? Recommend structural improvements.' },
      { id: 'productivity', icon: Zap, label: 'Team Productivity', prompt: 'Analyze team productivity by measuring output per person per department. Which teams are most productive? What factors might be affecting lower-performing teams? Include actionable recommendations.' },
    ],
  },
  {
    id: 'market',
    label: '🌐 Market',
    color: '#A855F7',
    analyses: [
      { id: 'competitive', icon: Globe, label: 'Competitive Analysis', prompt: 'Provide a comprehensive competitive analysis for an immigration law firm like ours. What are the top competitors doing differently? What market trends should we be aware of? What strategies can help us gain market share?' },
      { id: 'marketing', icon: Target, label: 'Marketing Strategy', prompt: 'Based on our team structure (Marketing, Openers, Closers, Dirección departments), analyze our marketing funnel and recommend improvements. Cover digital marketing, social media, lead generation, and conversion optimization for an immigration law firm.' },
      { id: 'growth', icon: TrendingUp, label: 'Growth Opportunities', prompt: 'Identify growth opportunities for our immigration law firm. Consider new service areas, geographic expansion, technology adoption, partnership opportunities, and client acquisition strategies.' },
    ],
  },
  {
    id: 'operations',
    label: '⚙️ Operations',
    color: '#22C55E',
    analyses: [
      { id: 'processes', icon: RefreshCw, label: 'Process Improvement', prompt: 'Analyze our operational processes based on task and document data. Identify areas for automation, standardization, and efficiency gains. Recommend specific process improvements for each department.' },
      { id: 'compliance', icon: Shield, label: 'Compliance & Risk', prompt: 'Review our operational data for compliance risks, security concerns, and operational vulnerabilities. What areas need immediate attention? What policies or procedures should be implemented or improved?' },
      { id: 'technology', icon: Lightbulb, label: 'Tech Recommendations', prompt: 'Based on our current platform usage and team workflows, recommend technology improvements, integrations, and tools that could increase efficiency. Consider AI automation, document management, client communication, and case management.' },
    ],
  },
  {
    id: 'documents',
    label: '📄 Documents',
    color: '#F59E0B',
    analyses: [
      { id: 'doc-review', icon: FileText, label: 'Document Portfolio Review', prompt: 'Review the entire document portfolio. What types of documents do we have? Are there gaps in our documentation? Which departments produce the most content? Recommend documents that should be created or improved.' },
      { id: 'templates', icon: BookOpen, label: 'Template Recommendations', prompt: 'Based on the types of documents we create and our immigration law focus, recommend standard templates and SOPs we should have. Include meeting notes, case intake forms, legal briefs, client communications, and operational procedures.' },
      { id: 'quality', icon: Scale, label: 'Content Quality', prompt: 'Analyze the quality of our document output based on word counts, categories, and organization. Are documents well-organized? What standards should we implement for document creation and management?' },
    ],
  },
];

export default function AIAnalysisPanel({ data, userId, userName }: Props) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState('');
  const [customQ, setCustomQ] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('performance');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analyses.length]);

  // Build platform context for AI
  const buildContext = () => {
    const tasks = data.tasks;
    const docs = data.docs;
    const members = data.members;
    const teams = data.teams;

    const completedTasks = tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
    const overdue = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'completed').length;

    // Build department summaries
    const deptSummaries = teams.map((t: any) => {
      const dTasks = tasks.filter((tk: any) => tk.teamId === t.id);
      const dDocs = docs.filter((d: any) => d.teamId === t.id);
      const dMembers = members.filter((m: any) => m.teamId === t.id);
      const dCompleted = dTasks.filter((tk: any) => tk.status === 'done' || tk.status === 'completed').length;
      return `- ${t.name} (${t.icon}): ${dMembers.length} members, ${dTasks.length} tasks (${dCompleted} completed, ${dTasks.length > 0 ? Math.round((dCompleted / dTasks.length) * 100) : 0}% rate), ${dDocs.length} documents`;
    }).join('\n');

    // Task status breakdown
    const statusBreak: Record<string, number> = {};
    tasks.forEach((t: any) => { statusBreak[t.status || 'unknown'] = (statusBreak[t.status || 'unknown'] || 0) + 1; });
    const statusStr = Object.entries(statusBreak).map(([s, c]) => `${s}: ${c}`).join(', ');

    // Priority breakdown
    const prioBreak: Record<string, number> = {};
    tasks.forEach((t: any) => { prioBreak[t.priority || 'medium'] = (prioBreak[t.priority || 'medium'] || 0) + 1; });
    const prioStr = Object.entries(prioBreak).map(([p, c]) => `${p}: ${c}`).join(', ');

    // Member roles
    const roleBreak: Record<string, number> = {};
    members.forEach((m: any) => { roleBreak[m.role || 'member'] = (roleBreak[m.role || 'member'] || 0) + 1; });
    const roleStr = Object.entries(roleBreak).map(([r, c]) => `${r}: ${c}`).join(', ');

    // Document titles
    const docList = docs.slice(0, 20).map((d: any) => `"${d.title}" (${d.wordCount || 0} words, ${d.visibility}, ${teams.find((t: any) => t.id === d.teamId)?.name || 'unassigned'})`).join('\n  ');

    // Selected department context
    let deptContext = '';
    if (selectedDept !== 'all') {
      const team = teams.find((t: any) => t.id === selectedDept);
      if (team) {
        const dTasks = tasks.filter((tk: any) => tk.teamId === team.id);
        const dDocs = docs.filter((d: any) => d.teamId === team.id);
        const dMembers = members.filter((m: any) => m.teamId === team.id);
        deptContext = `\n\n--- FOCUSED DEPARTMENT: ${team.name} ---
Members: ${dMembers.map((m: any) => `${m.displayName} (${m.role}, ${m.hierarchyLevel || 'member'})`).join(', ')}
Tasks: ${dTasks.map((t: any) => `"${t.title || 'Untitled'}" [${t.status}/${t.priority}]`).slice(0, 15).join(', ')}
Documents: ${dDocs.map((d: any) => `"${d.title}" (${d.wordCount || 0}w)`).slice(0, 10).join(', ')}`;
      }
    }

    // Selected document context
    let docContext = '';
    if (selectedDoc) {
      const doc = docs.find((d: any) => d.id === selectedDoc);
      if (doc) {
        docContext = `\n\n--- FOCUSED DOCUMENT ---
Title: ${doc.title}
Content (first 2000 chars): ${(doc.content || '').slice(0, 2000)}
Word Count: ${doc.wordCount || 0}
Created by: ${doc.createdByName}
Visibility: ${doc.visibility}
Department: ${teams.find((t: any) => t.id === doc.teamId)?.name || 'none'}
Tags: ${(doc.tags || []).join(', ')}`;
      }
    }

    return `
=== SOLIS CENTER — PLATFORM DATA CONTEXT ===
Organization: Law Office of Manuel Solis (Immigration Law)
Platform: Solis Center (Internal workspace with tasks, docs, chat, AI)
Analysis Date: ${new Date().toLocaleDateString()}
Analyzed by: ${userName}

--- SUMMARY ---
Total Members: ${members.length} (Roles: ${roleStr})
Total Tasks: ${tasks.length} (Completed: ${completedTasks}, Overdue: ${overdue}, Rate: ${tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%)
Total Documents: ${docs.length} (Total words: ${docs.reduce((s: number, d: any) => s + (d.wordCount || 0), 0).toLocaleString()})
Departments: ${teams.length}
Channels: ${data.channels.length}
AI Conversations: ${data.aiConversations.length}
Audit Log Events: ${data.auditLogs.length}

--- TASK BREAKDOWN ---
By Status: ${statusStr}
By Priority: ${prioStr}

--- DEPARTMENT DETAILS ---
${deptSummaries}

--- DOCUMENTS (top 20) ---
  ${docList || 'No documents yet'}
${deptContext}${docContext}
=== END CONTEXT ===
`;
  };

  const runAnalysis = async (question: string, type: string = 'custom') => {
    setLoading(true);
    setCurrentQ(question);

    try {
      const context = buildContext();
      const fullPrompt = `${context}\n\n--- ANALYSIS REQUEST ---\n${question}\n\nProvide a thorough, data-driven analysis based on the platform data above. Use specific numbers, percentages, and comparisons. Include clear recommendations. Format with markdown headers, bullet points, and tables where appropriate.`;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: fullPrompt,
          mode: 'research',
        }),
      });

      const result = await res.json();
      const answer = result.answer || result.error || 'No response from AI.';

      setAnalyses(prev => [...prev, {
        id: `a-${Date.now()}`,
        type,
        question,
        answer,
        timestamp: new Date(),
      }]);
    } catch (err: any) {
      setAnalyses(prev => [...prev, {
        id: `a-${Date.now()}`,
        type: 'error',
        question,
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

  // Markdown renderer (simplified)
  const renderMd = (text: string): string => {
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
      .replace(/^#### (.+)$/gm, '<h4 class="ai-h4">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="ai-bold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^> (.+)$/gm, '<blockquote class="ai-blockquote">$1</blockquote>')
      .replace(/^---$/gm, '<hr class="ai-hr" />')
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
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap anim-slide" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold text-gray-400">Focus:</span>
        </div>
        <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="select-dark h-8 text-xs">
          <option value="all">All Departments</option>
          {data.teams.map((t: any) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
        <select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)} className="select-dark h-8 text-xs max-w-xs">
          <option value="">All Documents</option>
          {data.docs.map((d: any) => <option key={d.id} value={d.id}>📄 {d.title || 'Untitled'}</option>)}
        </select>
        {(selectedDept !== 'all' || selectedDoc) && (
          <button onClick={() => { setSelectedDept('all'); setSelectedDoc(''); }} className="text-[10px] text-gray-600 hover:text-gray-400">Clear filters</button>
        )}
      </div>

      {/* Analysis categories */}
      <div className="space-y-2 anim-slide" style={{ animationDelay: '120ms' }}>
        {ANALYSIS_CATEGORIES.map(cat => (
          <div key={cat.id} className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden">
            <button onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.01] transition">
              <span className="text-lg">{cat.label.split(' ')[0]}</span>
              <span className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label.split(' ').slice(1).join(' ')}</span>
              <span className="text-[10px] text-gray-600 ml-2">{cat.analyses.length} analyses</span>
              <ChevronDown className={`h-4 w-4 text-gray-600 ml-auto transition-transform ${expandedCategory === cat.id ? 'rotate-180' : ''}`} />
            </button>
            {expandedCategory === cat.id && (
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-[#1F2937]/40 pt-3">
                {cat.analyses.map(a => (
                  <button key={a.id} onClick={() => runAnalysis(a.prompt, a.id)} disabled={loading}
                    className="flex items-start gap-3 p-4 rounded-xl border border-[#1F2937] bg-[#0C1017] hover:border-gray-600 text-left transition group card-hover disabled:opacity-50">
                    <a.icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: cat.color }} />
                    <div>
                      <p className="text-xs font-semibold text-gray-300 group-hover:text-white transition">{a.label}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{a.prompt.slice(0, 80)}...</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Custom query */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-5 anim-slide" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-bold text-purple-400">Custom Analysis</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">AI has full platform context</span>
        </div>
        <div className="flex gap-2">
          <textarea value={customQ} onChange={e => setCustomQ(e.target.value)} placeholder="Ask anything about your organization, team, market, operations, documents..."
            rows={2} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#111827] border border-[#1F2937] text-sm text-gray-200 placeholder:text-gray-700 outline-none focus:border-purple-500/30 resize-none disabled:opacity-50"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCustom(); } }} />
          <button onClick={handleCustom} disabled={loading || !customQ.trim()}
            className="h-[52px] px-5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20 text-sm font-semibold flex items-center gap-2 hover:bg-purple-500/25 transition disabled:opacity-30 shrink-0">
            <Send className="h-4 w-4" /> Analyze
          </button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {[
            '¿Cómo podemos mejorar la productividad del equipo?',
            'What are our biggest risks right now?',
            'Analiza nuestra estrategia de marketing vs competidores',
            'Recommend process automations',
          ].map((q, i) => (
            <button key={i} onClick={() => { setCustomQ(q); }} className="text-[10px] px-2 py-1 rounded-lg bg-[#111827] border border-[#1F2937] text-gray-600 hover:text-gray-400 transition">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {analyses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#D4A843]" />
            Analysis Results ({analyses.length})
          </h3>
          {analyses.map((a, i) => (
            <div key={a.id} className="rounded-2xl border border-[#1F2937]/60 bg-[#0C1017] overflow-hidden anim-fade">
              {/* Question header */}
              <div className="px-5 py-3 border-b border-[#1F2937]/40 bg-[#0A0E16] flex items-center gap-3">
                <Brain className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate">{a.question.slice(0, 120)}</p>
                  <p className="text-[9px] text-gray-700 mt-0.5">{a.timestamp.toLocaleTimeString()}</p>
                </div>
                <button onClick={() => copyResult(a.answer, a.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] text-gray-600 hover:text-gray-400 hover:bg-white/5 transition shrink-0">
                  {copiedId === a.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedId === a.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {/* Answer */}
              <div className="p-5 ai-content" dangerouslySetInnerHTML={{ __html: renderMd(a.answer) }} />
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-6 flex items-center gap-4 anim-fade">
          <Loader2 className="h-5 w-5 text-purple-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm text-purple-400 font-semibold">Analyzing platform data...</p>
            <p className="text-[11px] text-gray-600 mt-0.5">{currentQ.slice(0, 80)}{currentQ.length > 80 ? '...' : ''}</p>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}