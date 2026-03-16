'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Catches errors thrown inside the root layout itself.
 * Must provide its own <html>/<body> because the root layout is broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-[#13141A] text-[#E8E8F0]">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="text-5xl">!</div>
          <h1 className="text-xl font-semibold">Error crítico</h1>
          <p className="text-sm text-[#8E8EA8]">
            {error.digest
              ? `Referencia: ${error.digest}`
              : error.message || 'Ocurrió un error inesperado.'}
          </p>
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#7B68EE] text-white rounded-lg hover:bg-[#6C5CE7] transition-colors text-sm font-medium"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
