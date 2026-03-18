'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Copy, Check, Key, AlertTriangle, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface SCIMTokenInfo {
  id: string;
  name: string;
  createdBy: string;
  createdAt: { _seconds?: number; seconds?: number } | null;
  lastUsedAt: { _seconds?: number; seconds?: number } | null;
  active: boolean;
}

function formatDate(ts: { _seconds?: number; seconds?: number } | null, lang: string): string {
  if (!ts) return lang === 'es' ? 'Nunca' : 'Never';
  const seconds = ts._seconds || ts.seconds || 0;
  if (!seconds) return lang === 'es' ? 'Nunca' : 'Never';
  return new Date(seconds * 1000).toLocaleDateString(lang === 'es' ? 'es' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SCIMTokenManager() {
  const { lang } = useI18n();
  const [tokens, setTokens] = useState<SCIMTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/scim/v2/tokens');
      if (!res.ok) throw new Error('Failed to fetch tokens');
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch {
      setError(lang === 'es' ? 'Error al cargar tokens' : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async () => {
    if (!newTokenName.trim()) {
      setError(lang === 'es' ? 'El nombre es obligatorio' : 'Name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      const res = await fetch('/api/scim/v2/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create token');
      }

      const data = await res.json();
      setCreatedToken(data.token);
      setNewTokenName('');
      await fetchTokens();
    } catch (err: any) {
      setError(err.message || (lang === 'es' ? 'Error al crear token' : 'Failed to create token'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    try {
      setError('');
      const res = await fetch('/api/scim/v2/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId }),
      });

      if (!res.ok) throw new Error('Failed to revoke token');
      await fetchTokens();
    } catch {
      setError(lang === 'es' ? 'Error al revocar token' : 'Failed to revoke token');
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">
            {lang === 'es' ? 'Tokens SCIM' : 'SCIM Provisioning Tokens'}
          </span>
        </div>
        <button
          onClick={fetchTokens}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
          title={lang === 'es' ? 'Actualizar' : 'Refresh'}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-[12px] text-[var(--text-muted)]">
        {lang === 'es'
          ? 'Los tokens SCIM permiten a proveedores de identidad (Okta, Azure AD, etc.) aprovisionar usuarios automáticamente.'
          : 'SCIM tokens allow identity providers (Okta, Azure AD, etc.) to automatically provision and deprovision users.'}
      </p>

      {/* New token created - show once */}
      {createdToken && (
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-300">
              {lang === 'es'
                ? 'Copia este token ahora. No se mostrará de nuevo.'
                : 'Copy this token now. It will not be shown again.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] text-[12px] text-[var(--text-primary)] font-mono break-all select-all">
              {createdToken}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition"
              title={lang === 'es' ? 'Copiar' : 'Copy'}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            onClick={() => setCreatedToken(null)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            {lang === 'es' ? 'Cerrar' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Create new token */}
      <div className="flex items-center gap-2">
        <input
          value={newTokenName}
          onChange={e => { setNewTokenName(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder={lang === 'es' ? 'Nombre del token (ej: Okta Prod)' : 'Token name (e.g., Okta Production)'}
          className="flex-1 h-8 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]"
          disabled={creating}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newTokenName.trim()}
          className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90 transition disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      {/* Token list */}
      {loading ? (
        <div className="text-center py-6">
          <p className="text-[12px] text-[var(--text-muted)]">
            {lang === 'es' ? 'Cargando...' : 'Loading...'}
          </p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-6 rounded-xl bg-[var(--bg-secondary)]">
          <Shield className="h-6 w-6 mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-[12px] text-[var(--text-muted)]">
            {lang === 'es'
              ? 'No hay tokens SCIM. Crea uno para integrar con tu proveedor de identidad.'
              : 'No SCIM tokens yet. Create one to integrate with your identity provider.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {tokens.map(token => (
            <div
              key={token.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {token.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      token.active
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {token.active
                      ? (lang === 'es' ? 'Activo' : 'Active')
                      : (lang === 'es' ? 'Revocado' : 'Revoked')}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'es' ? 'Creado:' : 'Created:'} {formatDate(token.createdAt, lang)}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'es' ? 'Último uso:' : 'Last used:'} {formatDate(token.lastUsedAt, lang)}
                  </span>
                </div>
              </div>
              {token.active && (
                <button
                  onClick={() => handleRevoke(token.id)}
                  className="shrink-0 p-1.5 opacity-0 group-hover:opacity-100 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
                  title={lang === 'es' ? 'Revocar' : 'Revoke'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SCIM endpoint info */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <p className="text-[11px] text-[var(--text-muted)] mb-1">
          {lang === 'es' ? 'URL base SCIM:' : 'SCIM Base URL:'}
        </p>
        <code className="block px-3 py-2 rounded-lg bg-[var(--bg-primary)] text-[12px] text-[var(--text-secondary)] font-mono">
          {typeof window !== 'undefined' ? `${window.location.origin}/api/scim/v2` : '/api/scim/v2'}
        </code>
      </div>
    </div>
  );
}
