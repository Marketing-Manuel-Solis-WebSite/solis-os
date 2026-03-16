'use client';
import { FileInput } from 'lucide-react';

interface LazyFormRendererProps {
  formId?: string;
}

export default function LazyFormRenderer({ formId }: LazyFormRendererProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
        <FileInput className="h-8 w-8 text-purple-400" />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">Form Builder</p>
        <p className="text-[12px] text-[var(--text-muted)]">
          {formId ? `Editing form ${formId}` : 'Create a new form to get started'}
        </p>
      </div>
    </div>
  );
}
