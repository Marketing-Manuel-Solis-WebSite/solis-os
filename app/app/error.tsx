'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

/**
 * Catches errors inside /app/* routes without crashing the entire shell.
 * The sidebar and layout remain intact — only the content area shows this.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center space-y-5 max-w-sm">
        <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--error)]/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-[var(--error)]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Algo salió mal
          </h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            {error.message || 'Ocurrió un error al cargar esta sección.'}
          </p>
          {error.digest && (
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                       bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reintentar
          </button>
          <a
            href="/app"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                       bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
