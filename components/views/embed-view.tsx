'use client';

// ============================================================
// Embed View — Renders an external URL in a sandboxed iframe
// as a view tab. Equivalent to ClickUp's Embed view.
// ============================================================

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { ExternalLink, Loader2, AlertTriangle, Settings } from 'lucide-react';

interface Props {
  /** The URL to embed */
  url?: string;
  /** Callback to update the embedded URL */
  onUrlChange?: (url: string) => void;
  /** Whether the user can edit the URL */
  canEdit?: boolean;
}

export default function EmbedView({ url, onUrlChange, canEdit = false }: Props) {
  const { lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editMode, setEditMode] = useState(!url);
  const [inputUrl, setInputUrl] = useState(url || '');

  const handleSave = () => {
    if (inputUrl.trim() && onUrlChange) {
      onUrlChange(inputUrl.trim());
      setEditMode(false);
      setLoading(true);
      setError(false);
    }
  };

  // No URL configured
  if (!url || editMode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <ExternalLink className="h-10 w-10 text-[var(--text-muted)] mb-4 opacity-40" />
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">
          {lang === 'es' ? 'Vista Embebida' : 'Embed View'}
        </h3>
        <p className="text-[13px] text-[var(--text-muted)] mb-4 max-w-sm">
          {lang === 'es'
            ? 'Ingresa una URL para mostrar contenido externo dentro de SOLIS OS.'
            : 'Enter a URL to display external content inside SOLIS OS.'}
        </p>
        {canEdit || !url ? (
          <div className="w-full max-w-md">
            <input
              type="url"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="https://example.com"
              className="w-full h-10 px-4 rounded-xl bg-[var(--bg-elevated)] text-[14px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none mb-3"
              autoFocus
            />
            <div className="flex gap-2 justify-center">
              {url && (
                <button onClick={() => setEditMode(false)}
                  className="px-4 h-9 rounded-xl text-[13px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition">
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              )}
              <button onClick={handleSave} disabled={!inputUrl.trim()}
                className="px-5 h-9 rounded-xl text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 disabled:opacity-40 transition">
                {lang === 'es' ? 'Embeber' : 'Embed'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--text-muted)]">
            {lang === 'es' ? 'Contacta a un admin para configurar esta vista.' : 'Contact an admin to configure this view.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ExternalLink className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
          <span className="text-[11px] text-[var(--text-muted)] truncate">{url}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition"
            title={lang === 'es' ? 'Abrir en nueva pestaña' : 'Open in new tab'}>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {canEdit && (
            <button onClick={() => { setEditMode(true); setInputUrl(url); }}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition"
              title={lang === 'es' ? 'Cambiar URL' : 'Change URL'}>
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Iframe */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-base)] text-[var(--text-muted)]">
            <AlertTriangle className="h-8 w-8 mb-3 text-[var(--warning)]" />
            <p className="text-[13px]">
              {lang === 'es' ? 'No se pudo cargar el contenido.' : 'Could not load content.'}
            </p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent)] hover:underline mt-1">
              {lang === 'es' ? 'Abrir en nueva pestaña' : 'Open in new tab'}
            </a>
          </div>
        )}
        <iframe
          src={url}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          loading="lazy"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          title="Embedded content"
        />
      </div>
    </div>
  );
}
