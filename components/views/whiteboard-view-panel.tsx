'use client';

import React, { Suspense, lazy } from 'react';
import { useI18n } from '@/lib/i18n';
import { PenTool, Loader2 } from 'lucide-react';

const LazyWhiteboardCanvas = lazy(() => import('@/components/views/lazy-whiteboard-canvas'));

interface Props {
  artifactId: string;
  scopeType?: string;
  scopeId?: string;
}

export default function WhiteboardViewPanel({ artifactId }: Props) {
  const { lang } = useI18n();

  if (!artifactId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
        <PenTool className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">{lang === 'es' ? 'Selecciona un pizarrón' : 'Select a whiteboard'}</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[400px]">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      }>
        <LazyWhiteboardCanvas whiteboardId={artifactId} />
      </Suspense>
    </div>
  );
}
