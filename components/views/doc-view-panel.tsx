'use client';

import React, { Suspense, lazy } from 'react';
import { useI18n } from '@/lib/i18n';
import { FileText, Loader2 } from 'lucide-react';

const LazyDocEditor = lazy(() => import('@/components/views/lazy-doc-editor'));

interface Props {
  artifactId: string;
  scopeType?: string;
  scopeId?: string;
}

export default function DocViewPanel({ artifactId }: Props) {
  const { lang } = useI18n();

  if (!artifactId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
        <FileText className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">{lang === 'es' ? 'Selecciona un documento' : 'Select a document'}</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      }>
        <LazyDocEditor docId={artifactId} />
      </Suspense>
    </div>
  );
}
