'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Save, ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3, Quote, Code,
  Minus, Link, Image, Eye, Edit2, Sparkles,
  Lock, Globe, Users, X, Download, Type, Undo2, Redo2,
  Maximize2, Minimize2, Table, CheckSquare, FileText, Upload, FileDown,
} from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';
import { uploadFile, isImageType, formatFileSize } from '@/lib/upload';
import { useToast } from '@/components/notifications/toast-provider';
import { useI18n } from '@/lib/i18n';

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

// ========== TOOLBAR BUTTON ==========
function TBtn({ icon: Icon, label, onClick, active, disabled }: {
  icon: any; label: string; onClick: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition text-xs ${active ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'} ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function TSep() {
  return <div className="w-px h-5 bg-[var(--bg-elevated)]/80 mx-0.5" />;
}

// ========== MAIN EDITOR ==========
export default function DocEditor({ doc, members, isAdmin, userId, onSave, onDelete, onBack, onToggleAI, showAI }: DocEditorProps) {
  const toast = useToast();
  const { t } = useI18n();
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

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download menu
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

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

  // Close download menu on outside click
  useEffect(() => {
    if (!showDownloadMenu) return;
    const close = () => setShowDownloadMenu(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [showDownloadMenu]);

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
    try {
      await onSave(doc.id, {
        title,
        content,
        contentHtml: renderMarkdown(content),
        visibility,
        category: category.trim(),
        tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      });
      setDirty(false);
    } catch (err) {
      toast.error(t('docEditor.saveError'), t('docEditor.saveErrorMsg'));
    }
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

  // ========== IMAGE UPLOAD ==========
  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!isImageType(file.type)) {
        toast.warning(t('docEditor.unsupportedFormat'), t('docEditor.unsupportedFormatMsg'));
        continue;
      }
      setUploading(true);
      setUploadProgress(0);
      try {
        const result = await uploadFile(file, `docs/${doc.id}/images`, setUploadProgress);
        const markdownImg = `\n![${result.name}](${result.url})\n`;
        const el = editorRef.current;
        if (el) {
          const pos = el.selectionStart;
          const before = content.slice(0, pos);
          const after = content.slice(pos);
          pushUndo(content);
          setContent(before + markdownImg + after);
        } else {
          pushUndo(content);
          setContent(content + markdownImg);
        }
        setDirty(true);
      } catch (err: any) {
        toast.error(t('docEditor.uploadError'), err.message);
      }
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ========== DOWNLOAD ==========
  const styledHtml = (forPrint = false) => {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
body{font-family:'Segoe UI',system-ui,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333;line-height:1.8;background:#fff}
h1{border-bottom:2px solid #2563EB;padding-bottom:8px;color:#1a1a1a}
h2{color:#2563EB;margin-top:2rem}
h3{color:#555;margin-top:1.5rem}
blockquote{border-left:3px solid #2563EB;padding-left:16px;color:#666;font-style:italic;margin:1rem 0}
code{background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:0.9em}
pre{background:#1a1a2e;color:#e0e0e0;padding:16px;border-radius:8px;overflow-x:auto}
pre code{background:none;padding:0;color:inherit}
table{border-collapse:collapse;width:100%;margin:1rem 0}
th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
th{background:#f5f5f5;font-weight:600}
img{max-width:100%;border-radius:8px;margin:1rem 0}
figure{text-align:center;margin:1.5rem 0}
figcaption{font-size:0.75rem;color:#999;margin-top:0.5rem;font-style:italic}
a{color:#2563EB}
del{color:#999}
hr{border:none;border-top:2px solid #eee;margin:2rem 0}
ul,ol{padding-left:1.5rem}
li{margin-bottom:0.25rem}
${forPrint ? '@media print{body{margin:0;padding:10px}@page{margin:1.5cm}}' : ''}
</style></head><body>${renderMarkdown(content)}</body></html>`;
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadAs = (format: 'markdown' | 'html' | 'text' | 'pdf') => {
    setShowDownloadMenu(false);
    const filename = (title || 'document').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'document';

    switch (format) {
      case 'markdown':
        triggerDownload(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`);
        break;
      case 'html':
        triggerDownload(new Blob([styledHtml()], { type: 'text/html;charset=utf-8' }), `${filename}.html`);
        break;
      case 'text': {
        const plain = content
          .replace(/```[\s\S]*?```/g, '')
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/~~(.+?)~~/g, '$1')
          .replace(/__(.+?)__/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
          .replace(/^[-*]\s+/gm, '  - ')
          .replace(/^\d+\.\s+/gm, '  ')
          .replace(/^>\s+/gm, '  ')
          .replace(/^---$/gm, '')
          .replace(/\n{3,}/g, '\n\n');
        triggerDownload(new Blob([plain], { type: 'text/plain;charset=utf-8' }), `${filename}.txt`);
        break;
      }
      case 'pdf': {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { toast.warning(t('docEditor.popupBlocked'), t('docEditor.popupBlockedMsg')); return; }
        printWindow.document.write(styledHtml(true));
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
        break;
      }
    }
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const lineCount = content.split('\n').length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const visIcon = visibility === 'private' ? <Lock className="h-3 w-3" /> : visibility === 'public' ? <Globe className="h-3 w-3" /> : <Users className="h-3 w-3" />;
  const visColor = visibility === 'private' ? 'text-red-400 bg-red-500/10' : visibility === 'public' ? 'text-emerald-400 bg-emerald-500/10' : 'text-blue-400 bg-blue-500/10';

  const containerClass = fullscreen ? 'fixed inset-0 z-50 bg-[var(--bg-base)] flex flex-col' : 'flex flex-col h-full';

  return (
    <div className={containerClass}>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ''; }}
      />

      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-base)] shrink-0">
        <button onClick={onBack} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition">
          <ArrowLeft className="h-4 w-4" />
        </button>

        <input value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }}
          className="flex-1 bg-transparent text-lg font-bold text-[var(--text-primary)] border-none outline-none placeholder:text-[var(--text-muted)]"
          placeholder={t('docEditor.untitledDoc')} />

        <div className="flex items-center gap-1.5">
          {dirty && <span className="text-[12px] text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10">{t('docEditor.unsaved')}</span>}
          {saving && <span className="text-[12px] text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/10">{t('docEditor.saving')}</span>}
          {uploading && (
            <div className="flex items-center gap-2 px-2">
              <div className="w-16 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="text-[12px] text-[var(--accent)]">{uploadProgress}%</span>
            </div>
          )}

          <button onClick={() => setShowMeta(!showMeta)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold transition-all duration-200 ${visColor}`}>
            {visIcon} {visibility}
          </button>

          <button onClick={onToggleAI}
            className={`p-2 rounded-lg transition ${showAI ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)]'}`}
            title="AI Assistant">
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Download dropdown */}
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowDownloadMenu(!showDownloadMenu); }}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition" title="Download">
              <Download className="h-4 w-4" />
            </button>
            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-elevated)] rounded-xl shadow-dropdown z-20 py-1"
                onClick={e => e.stopPropagation()}>
                <button onClick={() => downloadAs('markdown')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-white/5 transition flex items-center gap-2">
                  <Type className="h-3.5 w-3.5" /> Markdown (.md)
                </button>
                <button onClick={() => downloadAs('html')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-white/5 transition flex items-center gap-2">
                  <Code className="h-3.5 w-3.5" /> HTML (.html)
                </button>
                <button onClick={() => downloadAs('text')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-white/5 transition flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Plain Text (.txt)
                </button>
                <div className="mx-3 my-1 border-t border-[var(--border-subtle)]" />
                <button onClick={() => downloadAs('pdf')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-white/5 transition flex items-center gap-2">
                  <FileDown className="h-3.5 w-3.5 text-red-400" /> PDF (Print)
                </button>
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || !dirty}
            className="px-4 h-8 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center gap-1.5 disabled:opacity-40">
            <Save className="h-3.5 w-3.5" /> {t('common.save')}
          </button>

          <button onClick={() => setFullscreen(!fullscreen)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Metadata panel */}
      {showMeta && (
        <div className="px-5 py-3 bg-[#0A0E16] flex items-center gap-4 flex-wrap anim-fade">
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[var(--text-muted)] uppercase font-semibold">{t('docCreate.visibility')}</label>
            <select value={visibility} onChange={e => { setVisibility(e.target.value as any); setDirty(true); }} className="select-dark h-7 text-[13px] px-2">
              <option value="team">{t('visibility.team')}</option>
              <option value="private">{t('visibility.private')}</option>
              <option value="public">{t('visibility.public')}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[var(--text-muted)] uppercase font-semibold">{t('docCreate.category')}</label>
            <input value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} placeholder={t('docCreate.category')} className="input-dark h-7 text-[13px] w-28 px-2" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[var(--text-muted)] uppercase font-semibold">{t('docCreate.tags')}</label>
            <input value={tags} onChange={e => { setTags(e.target.value); setDirty(true); }} placeholder="tag1, tag2" className="input-dark h-7 text-[13px] w-40 px-2" />
          </div>
          <div className="flex items-center gap-3 ml-auto text-[12px] text-[var(--text-muted)]">
            <span>{t('docEditor.byAuthor', { name: doc.createdByName || 'Unknown' })}</span>
            {doc.createdAt?.toDate && <span>{doc.createdAt.toDate().toLocaleDateString()}</span>}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 bg-[var(--bg-base)] flex-wrap shrink-0">
        <TBtn icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} disabled={undoStack.length === 0} />
        <TBtn icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={redoStack.length === 0} />
        <TSep />
        <TBtn icon={Heading1} label="Heading 1" onClick={() => insertAtLine('# ')} />
        <TBtn icon={Heading2} label="Heading 2" onClick={() => insertAtLine('## ')} />
        <TBtn icon={Heading3} label="Heading 3" onClick={() => insertAtLine('### ')} />
        <TSep />
        <TBtn icon={Bold} label="Bold (Ctrl+B)" onClick={() => insertFormat('**', '**')} />
        <TBtn icon={Italic} label="Italic (Ctrl+I)" onClick={() => insertFormat('*', '*')} />
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
        <TBtn icon={Image} label="Upload Image" onClick={() => fileInputRef.current?.click()} />

        <div className="flex-1" />

        {/* View mode */}
        <div className="flex rounded-xl bg-[var(--bg-tertiary)] overflow-hidden">
          <button onClick={() => setMode('edit')} className={`px-2.5 py-1 text-[12px] font-semibold transition ${mode === 'edit' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={() => setMode('split')} className={`px-2.5 py-1 text-[12px] font-semibold transition ${mode === 'split' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
            {t('docEditor.split')}
          </button>
          <button onClick={() => setMode('preview')} className={`px-2.5 py-1 text-[12px] font-semibold transition ${mode === 'preview' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
            <Eye className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Editor / Preview area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Drag-and-drop overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 bg-[var(--accent)]/5 border-2 border-dashed border-[var(--accent)]/40 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Upload className="h-8 w-8 text-[var(--accent)] mx-auto mb-2" />
              <p className="text-sm text-[var(--accent)] font-semibold">{t('docEditor.dropImageHere')}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{t('docEditor.maxImageSize')}</p>
            </div>
          </div>
        )}

        {/* Editor */}
        {(mode === 'edit' || mode === 'split') && (
          <div className={`${mode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleImageUpload(e.dataTransfer.files); }}
          >
            <textarea
              ref={editorRef}
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              placeholder="Start writing... Use markdown for formatting.&#10;&#10;# Heading 1&#10;## Heading 2&#10;### Heading 3&#10;&#10;**bold** *italic* ~~strikethrough~~&#10;&#10;- Bullet list&#10;- [ ] Checklist&#10;&#10;> Blockquote&#10;&#10;| Table | Header |&#10;|-------|--------|&#10;| Cell  | Cell   |&#10;&#10;Drag & drop images or click the image button to upload."
              className="flex-1 w-full bg-transparent text-gray-200 resize-none outline-none p-6 font-mono text-sm leading-relaxed placeholder:text-[var(--text-muted)]/60"
              style={{ tabSize: 2 }}
              spellCheck
              onKeyDown={e => {
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
      <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--bg-base)] text-[12px] text-[var(--text-muted)] shrink-0">
        <div className="flex items-center gap-4">
          <span>{t('docEditor.words', { n: wordCount })}</span>
          <span>{t('docEditor.chars', { n: charCount })}</span>
          <span>{t('docEditor.lines', { n: lineCount })}</span>
          <span>{t('docEditor.minRead', { n: readTime })}</span>
        </div>
        <div className="flex items-center gap-3">
          {doc.lastEditedByName && <span>{t('docEditor.lastEditedBy', { name: doc.lastEditedByName })}</span>}
          <span>{t('docEditor.ctrlSToSave')}</span>
          <span>{t('docEditor.markdown')}</span>
        </div>
      </div>
    </div>
  );
}
