'use client';
import { useEffect, useState, use } from 'react';
import { Loader2, AlertCircle, FileText, Lock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { renderMarkdown } from '@/lib/markdown';

interface SharedDoc {
  title: string;
  contentHtml: string;
  content: string;
  permission: string;
  createdByName: string;
  updatedAt: any;
}

export default function SharedDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t, lang } = useI18n();
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const loadDoc = async (pwd?: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/docs/public?token=${encodeURIComponent(token)}`;
      if (pwd) url += `&password=${encodeURIComponent(pwd)}`;

      const res = await fetch(url);

      if (res.status === 403) {
        setNeedsPassword(true);
        if (pwd) setPasswordError(true);
        setLoading(false);
        return;
      }

      if (res.status === 410) {
        const data = await res.json();
        setError(data.error === 'expired'
          ? (lang === 'es' ? 'Este enlace ha expirado' : 'This link has expired')
          : (lang === 'es' ? 'Este enlace ya no es válido' : 'This link is no longer valid'));
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(lang === 'es' ? 'Enlace inválido' : 'Invalid link');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setDoc(data);
      setNeedsPassword(false);
    } catch {
      setError(lang === 'es' ? 'Error al cargar el documento' : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoc();
  }, [token, lang]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);
    loadDoc(password);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--text-muted)]">
          {lang === 'es' ? 'Cargando documento...' : 'Loading document...'}
        </p>
      </div>
    );
  }

  // Password gate
  if (needsPassword) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-3 p-4">
        <div className="w-full max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] text-center mb-2">
            {lang === 'es' ? 'Documento protegido' : 'Protected document'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] text-center mb-6">
            {lang === 'es' ? 'Ingresa la contraseña para acceder' : 'Enter the password to access'}
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError(false); }}
              placeholder={lang === 'es' ? 'Contraseña' : 'Password'}
              autoFocus
              className={`w-full rounded-xl border bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] px-4 py-3 outline-none transition ${
                passwordError ? 'border-red-500' : 'border-[var(--border-default)] focus:border-[var(--accent)]'
              }`}
            />
            {passwordError && (
              <p className="text-sm text-red-400">
                {lang === 'es' ? 'Contraseña incorrecta' : 'Incorrect password'}
              </p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition"
            >
              {lang === 'es' ? 'Acceder' : 'Access'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !doc) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-3 p-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{error || t('docs.linkInvalid')}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {lang === 'es'
            ? 'El enlace puede haber expirado o ya no es válido.'
            : 'The link may have expired or is no longer valid.'}
        </p>
      </div>
    );
  }

  // Render the document content
  const html = doc.contentHtml || renderMarkdown(doc.content || '');

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-[var(--bg-elevated)]/80 backdrop-blur-sm border-b border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-[var(--text-primary)] truncate">{doc.title}</h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              {lang === 'es' ? 'Documento compartido' : 'Shared document'}
              {doc.createdByName ? ` — ${doc.createdByName}` : ''}
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
            {lang === 'es' ? 'Solo lectura' : 'Read only'}
          </span>
        </div>
      </div>

      {/* Document content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div
          className="doc-preview prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
