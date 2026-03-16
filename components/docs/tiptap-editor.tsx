'use client';

// ============================================================
// TipTap WYSIWYG Editor — rich-text editing with real-time
// collaboration via Yjs + Firestore provider.
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExt from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { FirestoreYjsProvider } from '@/lib/realtime/firestore-yjs-provider';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3, Quote, Code,
  Minus, Link as LinkIcon, Image, Table as TableIcon,
  CheckSquare, Highlighter, Undo2, Redo2, Upload, MessageSquareText,
} from 'lucide-react';
import { uploadFile, isImageType } from '@/lib/upload';
import { useToast } from '@/components/notifications/toast-provider';
import { CommentMark } from './inline-comment-mark';

// ─── Cursor colors for collaborators ─────────────────────
const CURSOR_COLORS = [
  '#7B68EE', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF',
  '#FF8A5C', '#B8B5FF', '#85E3FF', '#F38181', '#95E1D3',
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// ─── Toolbar button (matches doc-editor.tsx style) ───────
function TBtn({ icon: Icon, label, onClick, active, disabled }: {
  icon: any; label: string; onClick: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition text-xs
        ${active ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}
        ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function TSep() {
  return <div className="w-px h-5 bg-[var(--bg-elevated)]/80 mx-0.5" />;
}

// ─── Props ───────────────────────────────────────────────
interface TiptapEditorProps {
  docId: string;
  initialContent?: string;
  userId: string;
  userName: string;
  editable?: boolean;
  onUpdate?: (html: string) => void;
  onImageUpload?: (files: FileList) => Promise<string | null>;
  onAddComment?: (from: number, to: number, quotedText: string) => void;
}

export default function TiptapEditor({
  docId, initialContent, userId, userName, editable = true, onUpdate, onImageUpload, onAddComment,
}: TiptapEditorProps) {
  const toast = useToast();
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<FirestoreYjsProvider | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  // Initialize Yjs document + Firestore provider
  useEffect(() => {
    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    const color = pickColor(userId);

    const provider = new FirestoreYjsProvider({
      docId,
      ydoc,
      awareness,
      user: { id: userId, name: userName, color },
    });

    ydocRef.current = ydoc;
    providerRef.current = provider;
    awarenessRef.current = awareness;

    // If there's initial content and the Yjs doc is empty,
    // we'll set it after the editor mounts (see editor.onCreate)

    return () => {
      provider.destroy();
      awareness.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      awarenessRef.current = null;
    };
  }, [docId, userId, userName]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs handles undo/redo via collaboration
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: 'Start writing... Rich text formatting is available via the toolbar above.',
      }),
      ImageExt.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full' },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[var(--accent)] underline cursor-pointer' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CommentMark,
      Collaboration.configure({
        document: ydocRef.current!,
      }),
      CollaborationCursor.configure({
        provider: {
          awareness: awarenessRef.current!,
        } as any,
      }),
    ],
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none outline-none min-h-[300px] px-6 py-4 focus:outline-none',
      },
      handleDrop: (view, event) => {
        if (event.dataTransfer?.files?.length) {
          event.preventDefault();
          handleImageDrop(event.dataTransfer.files);
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const files = event.clipboardData?.files;
        if (files?.length) {
          event.preventDefault();
          handleImageDrop(files);
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor: ed }) => {
      // If Yjs doc is empty and we have initial HTML content, inject it
      if (ydocRef.current) {
        const xmlFragment = ydocRef.current.getXmlFragment('default');
        if (xmlFragment.length === 0 && initialContent) {
          ed.commands.setContent(initialContent);
        }
      }
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getHTML());
    },
  }, [ydocRef.current, awarenessRef.current]);

  // ─── Image handling ──────────────────────────────────
  const handleImageDrop = useCallback(async (files: FileList) => {
    if (!editor) return;
    for (const file of Array.from(files)) {
      if (!isImageType(file.type)) continue;
      setUploading(true);
      setUploadProgress(0);
      try {
        const result = await uploadFile(file, `docs/${docId}/images`, setUploadProgress);
        editor.chain().focus().setImage({ src: result.url, alt: result.name }).run();
      } catch (err: any) {
        toast.error('Upload failed', err.message);
      }
      setUploading(false);
      setUploadProgress(0);
    }
  }, [editor, docId, toast]);

  // ─── Link insertion ──────────────────────────────────
  const insertLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) return;
    editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setShowLinkInput(false);
  }, [editor]);

  // ─── Table insertion ─────────────────────────────────
  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  // ─── Inline comment ────────────────────────────────
  const handleAddComment = useCallback(() => {
    if (!editor || !onAddComment) return;
    const { from, to } = editor.state.selection;
    if (from === to) return; // no selection
    const quotedText = editor.state.doc.textBetween(from, to, ' ');
    onAddComment(from, to, quotedText);
  }, [editor, onAddComment]);

  if (!editor) return null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) handleImageDrop(e.target.files); e.target.value = ''; }}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 bg-[var(--bg-base)] flex-wrap shrink-0">
        <TBtn icon={Undo2} label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <TBtn icon={Redo2} label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
        <TSep />
        <TBtn icon={Heading1} label="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} />
        <TBtn icon={Heading2} label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
        <TBtn icon={Heading3} label="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} />
        <TSep />
        <TBtn icon={Bold} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <TBtn icon={Italic} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        <TBtn icon={UnderlineIcon} label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
        <TBtn icon={Strikethrough} label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
        <TBtn icon={Highlighter} label="Highlight" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} />
        <TSep />
        <TBtn icon={List} label="Bullet List" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <TBtn icon={ListOrdered} label="Numbered List" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <TBtn icon={CheckSquare} label="Task List" onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} />
        <TSep />
        <TBtn icon={Quote} label="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
        <TBtn icon={Code} label="Code Block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} />
        <TBtn icon={Minus} label="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <TBtn icon={TableIcon} label="Insert Table" onClick={insertTable} />
        <TSep />
        <TBtn icon={LinkIcon} label="Link" onClick={() => setShowLinkInput(!showLinkInput)} active={editor.isActive('link')} />
        <TBtn icon={Image} label="Upload Image" onClick={() => fileInputRef.current?.click()} />
        {onAddComment && (
          <>
            <TSep />
            <TBtn icon={MessageSquareText} label="Add Comment" onClick={handleAddComment} disabled={editor.state.selection.from === editor.state.selection.to} />
          </>
        )}

        {/* Link input (inline) */}
        {showLinkInput && (
          <div className="flex items-center gap-1 ml-2">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') insertLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
              placeholder="https://..."
              className="h-7 w-48 px-2 text-[13px] rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-subtle)] outline-none"
              autoFocus
            />
            <button onClick={insertLink} className="text-[12px] text-[var(--accent)] font-semibold px-2 py-1 rounded hover:bg-[var(--accent-subtle)]">OK</button>
            {editor.isActive('link') && (
              <button onClick={removeLink} className="text-[12px] text-red-400 font-semibold px-2 py-1 rounded hover:bg-red-500/10">Remove</button>
            )}
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="flex items-center gap-2 ml-2">
            <div className="w-16 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="text-[12px] text-[var(--accent)]">{uploadProgress}%</span>
          </div>
        )}
      </div>

      {/* Editor area */}
      <div
        className={`flex-1 overflow-y-auto relative ${dragOver ? 'ring-2 ring-[var(--accent)] ring-inset' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleImageDrop(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 bg-[var(--accent)]/5 border-2 border-dashed border-[var(--accent)]/40 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Upload className="h-8 w-8 text-[var(--accent)] mx-auto mb-2" />
              <p className="text-sm text-[var(--accent)] font-semibold">Drop image here</p>
            </div>
          </div>
        )}

        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
