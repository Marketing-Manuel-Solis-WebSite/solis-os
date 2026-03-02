'use client';
import { useState } from 'react';
import {
  Bot, Sparkles, Send, X, Copy, Check, ArrowRight, Loader2, Wand2,
  FileText, Lightbulb, Search, Scale, PenLine, Languages, Zap,
  BookOpen, Scissors, Maximize2, FileSignature, ListChecks,
  PenTool, GraduationCap, ArrowDownToLine, Plus,
} from 'lucide-react';

interface DocAIPanelProps {
  doc: any;
  onClose: () => void;
  onApply: (content: string) => void;
  onInsert: (content: string) => void;
}

type Tab = 'analyze' | 'improve' | 'create';

interface Prompt {
  id: string;
  icon: any;
  label: string;
  color: string;
  prompt: string;
  tab: Tab;
}

const PROMPTS: Prompt[] = [
  // Analyze
  { id: 'summarize', icon: FileText, label: 'Summarize', color: '#3B82F6', tab: 'analyze',
    prompt: 'Provide a clear, concise summary of this document. Include key points, main arguments, and conclusions.' },
  { id: 'suggestions', icon: Lightbulb, label: 'Suggestions', color: '#F59E0B', tab: 'analyze',
    prompt: 'Analyze this document and provide specific suggestions for improvement. Cover structure, clarity, completeness, and any missing information.' },
  { id: 'legal', icon: Scale, label: 'Legal Review', color: '#A855F7', tab: 'analyze',
    prompt: 'Review this document from a legal perspective. Identify any potential issues, missing clauses, ambiguous language, or areas that need attention for a law office context.' },
  { id: 'action', icon: Zap, label: 'Action Items', color: '#EF4444', tab: 'analyze',
    prompt: 'Extract all action items, tasks, deadlines, and follow-ups mentioned in this document. Format them as a clear checklist.' },
  { id: 'outline', icon: Search, label: 'Generate Outline', color: '#06B6D4', tab: 'analyze',
    prompt: 'Create a detailed outline/table of contents for this document based on its content and suggest additional sections that could improve it.' },

  // Improve
  { id: 'improve', icon: Wand2, label: 'Improve Writing', color: '#3B82F6', tab: 'improve',
    prompt: 'Improve the writing quality, clarity, grammar, and flow of this document while keeping the same meaning and structure. Return the improved full document content in markdown format.' },
  { id: 'proofread', icon: PenLine, label: 'Proofread', color: '#22C55E', tab: 'improve',
    prompt: 'Proofread this document thoroughly. List all grammar errors, spelling mistakes, punctuation issues, and style inconsistencies found.' },
  { id: 'translate', icon: Languages, label: 'Translate to Spanish', color: '#EC4899', tab: 'improve',
    prompt: 'Translate this entire document to Spanish while maintaining professional legal terminology and formatting. Return the full translated document in markdown format.' },
  { id: 'formal', icon: GraduationCap, label: 'Make Formal', color: '#8B5CF6', tab: 'improve',
    prompt: 'Rewrite this document in a more formal, professional tone suitable for legal and business correspondence. Return the full rewritten document in markdown format.' },
  { id: 'concise', icon: Scissors, label: 'Make Concise', color: '#F97316', tab: 'improve',
    prompt: 'Rewrite this document to be more concise and to-the-point while preserving all important information. Remove redundancies and verbose phrasing. Return the full rewritten document in markdown format.' },

  // Create
  { id: 'draft-next', icon: PenTool, label: 'Draft Next Section', color: '#10B981', tab: 'create',
    prompt: 'Based on the content and structure of this document, draft the next logical section that should follow. Write it in markdown format, matching the document\'s tone and style.' },
  { id: 'expand', icon: Maximize2, label: 'Expand Content', color: '#6366F1', tab: 'create',
    prompt: 'Expand and elaborate on the existing content of this document. Add more details, examples, explanations, and depth to each section while maintaining the document\'s structure. Return the full expanded document in markdown format.' },
  { id: 'conclusion', icon: FileSignature, label: 'Write Conclusion', color: '#14B8A6', tab: 'create',
    prompt: 'Write a comprehensive conclusion/closing section for this document that summarizes the key points and provides clear next steps or recommendations.' },
  { id: 'checklist', icon: ListChecks, label: 'Create Checklist', color: '#F43F5E', tab: 'create',
    prompt: 'Based on this document, create a detailed checklist of all items, requirements, or steps mentioned. Format using markdown checkboxes (- [ ] item).' },
];

const TABS: { id: Tab; label: string; icon: any; color: string }[] = [
  { id: 'analyze', label: 'Analyze', icon: Search, color: '#3B82F6' },
  { id: 'improve', label: 'Improve', icon: Wand2, color: '#3B82F6' },
  { id: 'create', label: 'Create', icon: PenTool, color: '#10B981' },
];

const APPLICABLE_KEYWORDS = ['improve', 'translate', 'rewrite', 'draft', 'create', 'generate', 'expand', 'formal', 'concise', 'conclusion', 'checklist'];

export default function DocAIPanel({ doc, onClose, onApply, onInsert }: DocAIPanelProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; isApplicable?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('analyze');

  // Generate full doc state
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const isDocEmpty = !doc.content || doc.content.trim().length < 30;

  const askAI = async (question: string, includeDoc: boolean = true) => {
    setLoading(true);
    const fullPrompt = includeDoc
      ? `Document Title: "${doc.title}"\n\nDocument Content:\n${doc.content}\n\n---\n\nInstruction: ${question}`
      : question;

    setMessages(prev => [...prev, { role: 'user', text: question }]);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: fullPrompt }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || 'No response from AI.';

      const isApplicable = APPLICABLE_KEYWORDS.some(kw =>
        question.toLowerCase().includes(kw)
      ) || PROMPTS.some(p =>
        (p.tab === 'improve' || p.tab === 'create') && p.prompt === question
      );

      setMessages(prev => [...prev, { role: 'ai', text: answer, isApplicable }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error connecting to AI. Check your Gemini API key.' }]);
    }
    setLoading(false);
  };

  const handleGenerateDoc = async () => {
    if (!generatePrompt.trim()) return;
    setGenerating(true);

    const systemPrompt = `You are a professional document writer for a law office. Create a complete, well-structured document in markdown format based on the following description. Use proper headings, sections, bullet points, and formatting. The document should be professional, thorough, and ready to use.\n\nDocument Title: "${doc.title}"\n\nDescription of what to write:\n${generatePrompt.trim()}\n\nWrite the full document content in markdown format:`;

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: systemPrompt }),
      });
      const data = await res.json();
      const answer = data.answer || '';
      if (answer && !data.error) {
        setMessages([
          { role: 'user', text: `Generate document: ${generatePrompt.trim()}` },
          { role: 'ai', text: answer, isApplicable: true },
        ]);
        setGeneratePrompt('');
      } else {
        setMessages([
          { role: 'user', text: `Generate document: ${generatePrompt.trim()}` },
          { role: 'ai', text: data.error || 'Failed to generate document.' },
        ]);
      }
    } catch {
      setMessages([
        { role: 'user', text: `Generate document: ${generatePrompt.trim()}` },
        { role: 'ai', text: 'Error connecting to AI. Check your API key.' },
      ]);
    }
    setGenerating(false);
  };

  const handleQuickPrompt = (prompt: Prompt) => {
    askAI(prompt.prompt);
  };

  const handleCustomQuestion = () => {
    if (!input.trim()) return;
    askAI(input.trim());
    setInput('');
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleApply = (text: string) => {
    if (confirm('Replace the document content with this AI-generated version?')) {
      onApply(text);
    }
  };

  const handleInsert = (text: string) => {
    onInsert(text);
  };

  const tabPrompts = PROMPTS.filter(p => p.tab === activeTab);

  return (
    <div className="w-[380px] shrink-0 bg-[var(--bg-base)] shadow-panel flex flex-col h-full overflow-hidden anim-slide">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Solis AI</p>
            <p className="text-[12px] text-[var(--text-muted)]">Document Assistant</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg"><X className="h-4 w-4" /></button>
      </div>

      {/* Generate Full Document (when doc is empty) */}
      {isDocEmpty && messages.length === 0 && (
        <div className="p-3">
          <div className="p-3 rounded-xl bg-[var(--accent-subtle)]">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-sm font-bold text-[var(--accent)]">Generate Full Document</span>
            </div>
            <p className="text-[12px] text-[var(--text-muted)] mb-2">Describe what you want and AI will create the full document.</p>
            <textarea
              value={generatePrompt}
              onChange={e => setGeneratePrompt(e.target.value)}
              placeholder="E.g. Write a client engagement letter for immigration consultation..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40 resize-none"
            />
            <button
              onClick={handleGenerateDoc}
              disabled={generating || !generatePrompt.trim()}
              className="mt-2 w-full h-8 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {generating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Generate Document</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Category Tabs + Quick Actions */}
      {messages.length === 0 && !generating && (
        <div className="p-3">
          {/* Tabs */}
          <div className="flex rounded-xl bg-[var(--bg-tertiary)] overflow-hidden mb-2.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[12px] font-semibold transition ${
                  activeTab === tab.id
                    ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/3'
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Prompts for active tab */}
          <div className="grid grid-cols-2 gap-1.5">
            {tabPrompts.map(p => (
              <button key={p.id} onClick={() => handleQuickPrompt(p)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-gray-200 hover:bg-[var(--bg-hover)] transition-all duration-200 text-left">
                <p.icon className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !generating && (
          <div className="text-center py-8">
            <Bot className="h-10 w-10 text-gray-800 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">Ask me anything about this document,</p>
            <p className="text-sm text-[var(--text-muted)]">or use a quick action above.</p>
          </div>
        )}

        {generating && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 text-[var(--accent)] animate-spin" />
            <span className="text-sm text-[var(--text-muted)]">Generating document...</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-lg rounded-tr-md bg-[var(--accent-subtle)]">
                <p className="text-sm text-[var(--accent)]">{msg.text.length > 80 ? msg.text.slice(0, 80) + '...' : msg.text}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="text-[12px] font-semibold text-[var(--accent)]">Solis AI</span>
                </div>
                <div className="px-3.5 py-3 rounded-lg rounded-tl-md bg-[var(--bg-elevated)]">
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
                <div className="flex items-center gap-1.5 pl-1 flex-wrap">
                  <button onClick={() => handleCopy(msg.text, i)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition">
                    {copied === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied === i ? 'Copied' : 'Copy'}
                  </button>
                  {msg.isApplicable && (
                    <>
                      <button onClick={() => handleApply(msg.text)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition">
                        <ArrowRight className="h-3 w-3" />
                        Replace Doc
                      </button>
                      <button onClick={() => handleInsert(msg.text)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] text-emerald-400 hover:bg-emerald-500/10 transition">
                        <ArrowDownToLine className="h-3 w-3" />
                        Insert at End
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 px-3 py-3">
            <Loader2 className="h-4 w-4 text-[var(--accent)] animate-spin" />
            <span className="text-sm text-[var(--text-muted)]">Analyzing document...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-[#0A0E16]">
        {messages.length > 0 && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
            {PROMPTS.filter(p => p.tab === activeTab).slice(0, 4).map(p => (
              <button key={p.id} onClick={() => handleQuickPrompt(p)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all duration-200 whitespace-nowrap shrink-0">
                <p.icon className="h-3 w-3" style={{ color: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask about this document..."
            className="input-dark h-9 text-sm flex-1"
            onKeyDown={e => e.key === 'Enter' && handleCustomQuestion()}
            disabled={loading} />
          <button onClick={handleCustomQuestion} disabled={loading || !input.trim()}
            className="h-9 px-4 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
