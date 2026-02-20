'use client';
import { useState } from 'react';
import { Bot, Sparkles, Send, X, Copy, Check, ArrowRight, Loader2, Wand2, FileText, Lightbulb, Search, Scale, PenLine, Languages, Zap } from 'lucide-react';

interface DocAIPanelProps {
  doc: any;
  onClose: () => void;
  onApply: (content: string) => void;
}

const PROMPTS = [
  { id: 'improve', icon: Wand2, label: 'Improve Writing', color: '#D4A843', prompt: 'Improve the writing quality, clarity, grammar, and flow of this document while keeping the same meaning and structure. Return the improved full document content.' },
  { id: 'summarize', icon: FileText, label: 'Summarize', color: '#3B82F6', prompt: 'Provide a clear, concise summary of this document. Include key points, main arguments, and conclusions.' },
  { id: 'suggestions', icon: Lightbulb, label: 'Suggestions', color: '#F59E0B', prompt: 'Analyze this document and provide specific suggestions for improvement. Cover structure, clarity, completeness, and any missing information.' },
  { id: 'legal', icon: Scale, label: 'Legal Review', color: '#A855F7', prompt: 'Review this document from a legal perspective. Identify any potential issues, missing clauses, ambiguous language, or areas that need attention for a law office context.' },
  { id: 'proofread', icon: PenLine, label: 'Proofread', color: '#22C55E', prompt: 'Proofread this document thoroughly. List all grammar errors, spelling mistakes, punctuation issues, and style inconsistencies found.' },
  { id: 'translate', icon: Languages, label: 'Translate to Spanish', color: '#EC4899', prompt: 'Translate this entire document to Spanish while maintaining professional legal terminology and formatting.' },
  { id: 'action', icon: Zap, label: 'Extract Action Items', color: '#EF4444', prompt: 'Extract all action items, tasks, deadlines, and follow-ups mentioned in this document. Format them as a clear checklist.' },
  { id: 'outline', icon: Search, label: 'Generate Outline', color: '#06B6D4', prompt: 'Create a detailed outline/table of contents for this document based on its content and suggest additional sections that could improve it.' },
];

export default function DocAIPanel({ doc, onClose, onApply }: DocAIPanelProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; isApplicable?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

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

      // Determine if this response can be applied as content
      const isApplicable = ['improve', 'translate'].some(id =>
        PROMPTS.find(p => p.id === id)?.prompt === question
      ) || question.toLowerCase().includes('rewrite') || question.toLowerCase().includes('improve');

      setMessages(prev => [...prev, { role: 'ai', text: answer, isApplicable }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error connecting to AI. Check your Gemini API key.' }]);
    }
    setLoading(false);
  };

  const handleQuickPrompt = (prompt: typeof PROMPTS[0]) => {
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
    if (confirm('Replace the document content with this AI-generated version? The current content will be replaced.')) {
      onApply(text);
    }
  };

  return (
    <div className="w-[380px] shrink-0 bg-[#0C1017] border-l border-[#1F2937]/60 flex flex-col h-full overflow-hidden anim-slide">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1F2937]/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 border border-[#D4A843]/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#D4A843]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Solis AI</p>
            <p className="text-[10px] text-gray-600">Document Assistant</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-4 w-4" /></button>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="p-3 border-b border-[#1F2937]/40">
          <p className="text-[10px] text-gray-600 uppercase font-semibold tracking-wider mb-2 px-1">Quick Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PROMPTS.map(p => (
              <button key={p.id} onClick={() => handleQuickPrompt(p)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium bg-[#111827] border border-[#1F2937] hover:border-gray-600 text-gray-400 hover:text-gray-200 transition text-left">
                <p.icon className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="h-10 w-10 text-gray-800 mx-auto mb-3" />
            <p className="text-xs text-gray-600">Ask me anything about this document,</p>
            <p className="text-xs text-gray-600">or use a quick action above.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-[#D4A843]/10 border border-[#D4A843]/20">
                <p className="text-xs text-[#D4A843]">{msg.text.length > 80 ? msg.text.slice(0, 80) + '...' : msg.text}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="h-3.5 w-3.5 text-[#D4A843]" />
                  <span className="text-[10px] font-semibold text-[#D4A843]">Solis AI</span>
                </div>
                <div className="px-3.5 py-3 rounded-2xl rounded-tl-md bg-[#111827] border border-[#1F2937]/60">
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
                <div className="flex items-center gap-1.5 pl-1">
                  <button onClick={() => handleCopy(msg.text, i)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-gray-600 hover:text-gray-400 hover:bg-white/5 transition">
                    {copied === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied === i ? 'Copied' : 'Copy'}
                  </button>
                  {msg.isApplicable && (
                    <button onClick={() => handleApply(msg.text)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-[#D4A843] hover:bg-[#D4A843]/10 transition">
                      <ArrowRight className="h-3 w-3" />
                      Apply to Doc
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 px-3 py-3">
            <Loader2 className="h-4 w-4 text-[#D4A843] animate-spin" />
            <span className="text-xs text-gray-500">Analyzing document...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#1F2937]/60 bg-[#0A0E16]">
        {messages.length > 0 && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
            {PROMPTS.slice(0, 4).map(p => (
              <button key={p.id} onClick={() => handleQuickPrompt(p)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-[#111827] border border-[#1F2937] text-gray-500 hover:text-gray-300 transition whitespace-nowrap shrink-0">
                <p.icon className="h-3 w-3" style={{ color: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask about this document..."
            className="input-dark h-9 text-xs flex-1"
            onKeyDown={e => e.key === 'Enter' && handleCustomQuestion()}
            disabled={loading} />
          <button onClick={handleCustomQuestion} disabled={loading || !input.trim()}
            className="h-9 px-4 rounded-xl btn-gold text-xs disabled:opacity-40">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}