'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Save, ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3, Quote, Code,
  Minus, Link, Image, AlignLeft, Eye, Edit2, Bot, Sparkles,
  Lock, Globe, Users, Hash, Star, StarOff, Trash2, Clock, X,
  ChevronDown, MoreHorizontal, Copy, Download, Type, Undo2, Redo2,
  Maximize2, Minimize2, Table, CheckSquare
} from 'lucide-react';

interface DocEditorProps {
  doc: any;
  members: any[];
  isAdmin: boolean;
  userId: string;
  onSave: (id: string, data: any) => Promise<void>;
  onDelete: (doc: any) => void;
  onBack: () => void;
  onToggleAI: () => void;
  showAI: boolean;
}

// ========== MARKDOWN RENDERER ==========
function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre class="doc-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="doc-inline-code">$1</code>');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="doc-h6">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="doc-h5">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="doc-h4">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="doc-h3">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="doc-h2">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="doc-h1">$1</h1>');

  // Bold, italic, strikethrough
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/__(.+?)__/g, '<u>$1</u>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="doc-hr" />');

  // Blockquote
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="doc-blockquote">$1</blockquote>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_m, header, _sep, body) => {
    const heads = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th class="doc-th">${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td class="doc-td">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="doc-table"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Checkbox lists
  html = html.replace(/^- \[x\]\s+(.+)$/gm, '<div class="doc-checkbox checked"><span class="doc-check">✓</span> <span class="doc-check-text done">$1</span></div>');
  html = html.replace(/^- \[ \]\s+(.+)$/gm, '<div class="doc-checkbox"><span class="doc-check-empty">○</span> <span class="doc-check-text">$1</span></div>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>');
  html = html.replace(/((?:<li class="doc-li">.*<\/li>\n?)+)/g, '<ul class="doc-ul">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="doc-oli">$1</li>');
  html = html.replace(/((?:<li class="doc-oli">.*<\/li>\n?)+)/g, '<ol class="doc-ol">$1</ol>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank" rel="noopener">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="doc-img" />');

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="doc-p">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p class="doc-p"><\/p>/g, '<br />');

  return html;
}

// ========== TOOLBAR BUTTON ==========
function TBtn({ icon: Icon, label, onClick, active, disabled }: {
  icon: any; label: string; onClick: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition text-xs ${active ? 'bg-[#D4A843]/15 text-[#D4A843]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'} ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function TSep() {
  return <div className="w-px h-5 bg-[#1F2937]/80 mx-0.5" />;
}

// ========== MAIN EDITOR ==========
export default function DocEditor({ doc, members, isAdmin, userId, onSave, onDelete, onBack, onToggleAI, showAI }: DocEditorProps) {
  const [content, setContent] = useState(doc.content || '');
  const [title, setTitle] = useState(doc.title || '');
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [visibility, setVisibility] = useState(doc.visibility || 'team');
  const [category, setCategory] = useState(doc.category || '');
  const [tags, setTags] = useState(doc.tags?.join(', ') || '');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Sync doc changes
  useEffect(() => {
    setContent(doc.content || '');
    setTitle(doc.title || '');
    setVisibility(doc.visibility || 'team');
    setCategory(doc.category || '');
    setTags(doc.tags?.join(', ') || '');
    setDirty(false);
  }, [doc.id]);

  // Auto-save timer
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => handleSave(), 5000);
    return () => clearTimeout(timer);
  }, [content, title, dirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); insertFormat('**', '**'); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); insertFormat('*', '*'); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) { e.preventDefault(); redo(); }
        else { e.preventDefault(); undo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [content, undoStack, redoStack]);

  const pushUndo = useCallback((val: string) => {
    setUndoStack(prev => [...prev.slice(-50), val]);
    setRedoStack([]);
  }, []);

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, content]);
    setContent(prev);
    setDirty(true);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, content]);
    setContent(next);
    setDirty(true);
  };

  const handleContentChange = (val: string) => {
    pushUndo(content);
    setContent(val);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(doc.id, {
      title,
      content,
      contentHtml: renderMarkdown(content),
      visibility,
      category: category.trim(),
      tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
    });
    setDirty(false);
    setSaving(false);
  };

  // Insert markdown formatting at cursor
  const insertFormat = (prefix: string, suffix: string = '') => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const before = content.slice(0, start);
    const after = content.slice(end);
    const newText = `${before}${prefix}${selected || 'text'}${suffix}${after}`;
    pushUndo(content);
    setContent(newText);
    setDirty(true);
    setTimeout(() => {
      el.focus();
      if (selected) {
        el.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        el.setSelectionRange(start + prefix.length, start + prefix.length + 4);
      }
    }, 0);
  };

  const insertAtLine = (prefix: string) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const before = content.slice(0, lineStart);
    const after = content.slice(lineStart);
    const newText = `${before}${prefix}${after}`;
    pushUndo(content);
    setContent(newText);
    setDirty(true);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const insertBlock = (block: string) => {
    const el = editorRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = content.slice(0, pos);
    const after = content.slice(pos);
    const newText = `${before}\n${block}\n${after}`;
    pushUndo(content);
    setContent(newText);
    setDirty(true);
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const lineCount = content.split('\n').length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const visIcon = visibility === 'private' ? <Lock className="h-3 w-3" /> : visibility === 'public' ? <Globe className="h-3 w-3" /> : <Users className="h-3 w-3" />;
  const visColor = visibility === 'private' ? 'text-red-400 bg-red-500/10 border-red-500/20' : visibility === 'public' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20';

  const containerClass = fullscreen ? 'fixed inset-0 z-50 bg-[#06080F] flex flex-col' : 'flex flex-col h-full';

  return (
    <div className={containerClass}>
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1F2937]/60 bg-[#0C1017] shrink-0">
        <button onClick={onBack} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg transition">
          <ArrowLeft className="h-4 w-4" />
        </button>

        <input value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }}
          className="flex-1 bg-transparent text-lg font-bold text-white border-none outline-none placeholder:text-gray-600"
          placeholder="Untitled Document" />

        <div className="flex items-center gap-1.5">
          {dirty && <span className="text-[10px] text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">Unsaved</span>}
          {saving && <span className="text-[10px] text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">Saving...</span>}

          <button onClick={() => setShowMeta(!showMeta)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${visColor}`}>
            {visIcon} {visibility}
          </button>

          <button onClick={onToggleAI}
            className={`p-2 rounded-lg transition ${showAI ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-[#D4A843] hover:bg-[#D4A843]/5'}`}
            title="AI Assistant">
            <Sparkles className="h-4 w-4" />
          </button>

          <button onClick={handleSave} disabled={saving || !dirty}
            className="px-4 h-8 rounded-xl btn-gold text-xs flex items-center gap-1.5 disabled:opacity-40">
            <Save className="h-3.5 w-3.5" /> Save
          </button>

          <button onClick={() => setFullscreen(!fullscreen)} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Metadata panel */}
      {showMeta && (
        <div className="px-5 py-3 border-b border-[#1F2937]/60 bg-[#0A0E16] flex items-center gap-4 flex-wrap anim-fade">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-600 uppercase font-semibold">Visibility</label>
            <select value={visibility} onChange={e => { setVisibility(e.target.value as any); setDirty(true); }} className="select-dark h-7 text-[11px] px-2">
              <option value="team">🏢 Team</option>
              <option value="private">🔒 Private</option>
              <option value="public">🌐 Public</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-600 uppercase font-semibold">Category</label>
            <input value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} placeholder="Category" className="input-dark h-7 text-[11px] w-28 px-2" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-600 uppercase font-semibold">Tags</label>
            <input value={tags} onChange={e => { setTags(e.target.value); setDirty(true); }} placeholder="tag1, tag2" className="input-dark h-7 text-[11px] w-40 px-2" />
          </div>
          <div className="flex items-center gap-3 ml-auto text-[10px] text-gray-700">
            <span>By {doc.createdByName || 'Unknown'}</span>
            {doc.createdAt?.toDate && <span>{doc.createdAt.toDate().toLocaleDateString()}</span>}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-[#1F2937]/60 bg-[#0C1017] flex-wrap shrink-0">
        <TBtn icon={Undo2} label="Undo (⌘Z)" onClick={undo} disabled={undoStack.length === 0} />
        <TBtn icon={Redo2} label="Redo (⌘⇧Z)" onClick={redo} disabled={redoStack.length === 0} />
        <TSep />
        <TBtn icon={Heading1} label="Heading 1" onClick={() => insertAtLine('# ')} />
        <TBtn icon={Heading2} label="Heading 2" onClick={() => insertAtLine('## ')} />
        <TBtn icon={Heading3} label="Heading 3" onClick={() => insertAtLine('### ')} />
        <TSep />
        <TBtn icon={Bold} label="Bold (⌘B)" onClick={() => insertFormat('**', '**')} />
        <TBtn icon={Italic} label="Italic (⌘I)" onClick={() => insertFormat('*', '*')} />
        <TBtn icon={UnderlineIcon} label="Underline" onClick={() => insertFormat('__', '__')} />
        <TBtn icon={Strikethrough} label="Strikethrough" onClick={() => insertFormat('~~', '~~')} />
        <TSep />
        <TBtn icon={List} label="Bullet List" onClick={() => insertAtLine('- ')} />
        <TBtn icon={ListOrdered} label="Numbered List" onClick={() => insertAtLine('1. ')} />
        <TBtn icon={CheckSquare} label="Checklist" onClick={() => insertAtLine('- [ ] ')} />
        <TSep />
        <TBtn icon={Quote} label="Blockquote" onClick={() => insertAtLine('> ')} />
        <TBtn icon={Code} label="Code Block" onClick={() => insertBlock('```\n\n```')} />
        <TBtn icon={Minus} label="Divider" onClick={() => insertBlock('---')} />
        <TBtn icon={Table} label="Table" onClick={() => insertBlock('| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell     | Cell     | Cell     |')} />
        <TSep />
        <TBtn icon={Link} label="Link" onClick={() => insertFormat('[', '](url)')} />
        <TBtn icon={Image} label="Image" onClick={() => insertFormat('![alt](', ')')} />

        <div className="flex-1" />

        {/* View mode */}
        <div className="flex rounded-lg border border-[#1F2937]/60 overflow-hidden">
          <button onClick={() => setMode('edit')} className={`px-2.5 py-1 text-[10px] font-semibold transition ${mode === 'edit' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-gray-400'}`}>
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={() => setMode('split')} className={`px-2.5 py-1 text-[10px] font-semibold transition ${mode === 'split' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-gray-400'}`}>
            Split
          </button>
          <button onClick={() => setMode('preview')} className={`px-2.5 py-1 text-[10px] font-semibold transition ${mode === 'preview' ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-gray-400'}`}>
            <Eye className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Editor / Preview area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        {(mode === 'edit' || mode === 'split') && (
          <div className={`${mode === 'split' ? 'w-1/2 border-r border-[#1F2937]/40' : 'w-full'} flex flex-col`}>
            <textarea
              ref={editorRef}
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              placeholder="Start writing... Use markdown for formatting.&#10;&#10;# Heading 1&#10;## Heading 2&#10;### Heading 3&#10;&#10;**bold** *italic* ~~strikethrough~~&#10;&#10;- Bullet list&#10;- [ ] Checklist&#10;&#10;> Blockquote&#10;&#10;| Table | Header |&#10;|-------|--------|&#10;| Cell  | Cell   |"
              className="flex-1 w-full bg-transparent text-gray-200 resize-none outline-none p-6 font-mono text-sm leading-relaxed placeholder:text-gray-700/60"
              style={{ tabSize: 2 }}
              spellCheck
              onKeyDown={e => {
                // Tab inserts 2 spaces
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const el = editorRef.current!;
                  const start = el.selectionStart;
                  const before = content.slice(0, start);
                  const after = content.slice(start);
                  pushUndo(content);
                  setContent(before + '  ' + after);
                  setDirty(true);
                  setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2; }, 0);
                }
                // Enter on list items continues the list
                if (e.key === 'Enter') {
                  const el = editorRef.current!;
                  const pos = el.selectionStart;
                  const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
                  const line = content.slice(lineStart, pos);
                  const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
                  const checkMatch = line.match(/^(\s*)- \[[ x]\]\s/);
                  if (checkMatch) {
                    e.preventDefault();
                    const prefix = `\n${checkMatch[1]}- [ ] `;
                    const before = content.slice(0, pos);
                    const after = content.slice(pos);
                    pushUndo(content);
                    setContent(before + prefix + after);
                    setDirty(true);
                    setTimeout(() => { el.selectionStart = el.selectionEnd = pos + prefix.length; }, 0);
                  } else if (listMatch) {
                    e.preventDefault();
                    const num = listMatch[2].match(/\d+/);
                    const prefix = num ? `\n${listMatch[1]}${parseInt(num[0]) + 1}. ` : `\n${listMatch[1]}${listMatch[2]} `;
                    const before = content.slice(0, pos);
                    const after = content.slice(pos);
                    pushUndo(content);
                    setContent(before + prefix + after);
                    setDirty(true);
                    setTimeout(() => { el.selectionStart = el.selectionEnd = pos + prefix.length; }, 0);
                  }
                }
              }}
            />
          </div>
        )}

        {/* Preview */}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`${mode === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto`}>
            <div className="doc-preview p-6 max-w-3xl mx-auto"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[#1F2937]/60 bg-[#0C1017] text-[10px] text-gray-700 shrink-0">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
          <span>{lineCount} lines</span>
          <span>~{readTime} min read</span>
        </div>
        <div className="flex items-center gap-3">
          {doc.lastEditedByName && <span>Last edited by {doc.lastEditedByName}</span>}
          <span>⌘S to save</span>
          <span>Markdown</span>
        </div>
      </div>
    </div>
  );
}