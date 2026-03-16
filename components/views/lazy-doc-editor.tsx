'use client';
import { FileText } from 'lucide-react';

interface LazyDocEditorProps {
  docId?: string;
}

export default function LazyDocEditor({ docId }: LazyDocEditorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
        <FileText className="h-8 w-8 text-blue-400" />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">Document Editor</p>
        <p className="text-[12px] text-[var(--text-muted)]">
          {docId ? `Editing document ${docId}` : 'Create a new document to get started'}
        </p>
      </div>
    </div>
  );
}
