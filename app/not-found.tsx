import { FileQuestion, Home } from 'lucide-react';

/**
 * 404 page — catches any route that doesn't match.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center space-y-5 max-w-sm px-6">
        <div className="mx-auto w-14 h-14 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
          <FileQuestion className="w-7 h-7 text-[var(--accent)]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">404</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            La página que buscas no existe o fue movida.
          </p>
        </div>
        <a
          href="/app"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg
                     bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Home className="w-4 h-4" />
          Ir al Dashboard
        </a>
      </div>
    </div>
  );
}
