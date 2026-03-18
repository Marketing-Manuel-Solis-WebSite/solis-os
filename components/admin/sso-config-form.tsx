'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  Shield, Save, Loader2, AlertTriangle, Check, X, Plus, Trash2,
  Download, Zap, ExternalLink, Copy,
} from 'lucide-react';

interface SSOConfig {
  enabled: boolean;
  provider: 'saml' | 'oidc';
  providerName: string;
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;
  attributeMapping: {
    email: string;
    displayName: string;
    role?: string;
  };
  autoProvision: boolean;
  defaultRole: string;
  allowedDomains: string[];
}

const DEFAULT_CONFIG: SSOConfig = {
  enabled: false,
  provider: 'oidc',
  providerName: '',
  attributeMapping: { email: 'email', displayName: 'name' },
  autoProvision: false,
  defaultRole: 'member',
  allowedDomains: [],
};

export default function SSOConfigForm() {
  const { user } = useAuth();
  const { lang } = useI18n();

  const [config, setConfig] = useState<SSOConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [copied, setCopied] = useState(false);

  const es = lang === 'es';

  useEffect(() => {
    loadConfig();
  }, []);

  async function getAuthHeaders(): Promise<HeadersInit> {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  async function loadConfig() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth/sso/config', { headers });
      if (res.ok) {
        const data = await res.json();
        setConfig({ ...DEFAULT_CONFIG, ...data, attributeMapping: { ...DEFAULT_CONFIG.attributeMapping, ...(data.attributeMapping || {}) } });
      }
    } catch {
      setError(es ? 'Error cargando configuracion SSO' : 'Failed to load SSO config');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth/sso/config', {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        const details = data.details?.join(', ') || data.error || 'Save failed';
        setError(details);
      } else {
        setSuccess(es ? 'Configuracion guardada' : 'Configuration saved');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError(es ? 'Error guardando' : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/auth/sso/initiate');
      const data = await res.json();
      if (data.url) {
        setTestResult({ ok: true, msg: es ? 'Configuracion valida. URL de redireccion generada.' : 'Configuration valid. Redirect URL generated.' });
      } else {
        setTestResult({ ok: false, msg: data.error || (es ? 'Fallo la prueba' : 'Test failed') });
      }
    } catch {
      setTestResult({ ok: false, msg: es ? 'Error de conexion' : 'Connection error' });
    } finally {
      setTesting(false);
    }
  }

  function handleAddDomain() {
    const d = newDomain.trim().toLowerCase();
    if (!d) return;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(d)) {
      setDomainError(es ? 'Dominio invalido' : 'Invalid domain');
      return;
    }
    if (config.allowedDomains.includes(d)) {
      setDomainError(es ? 'Ya existe' : 'Already exists');
      return;
    }
    setConfig({ ...config, allowedDomains: [...config.allowedDomains, d] });
    setNewDomain('');
    setDomainError('');
  }

  function handleRemoveDomain(idx: number) {
    setConfig({ ...config, allowedDomains: config.allowedDomains.filter((_, i) => i !== idx) });
  }

  function copyMetadataUrl() {
    const url = `${window.location.origin}/api/auth/sso/metadata`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputCls = 'w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]';
  const labelCls = 'text-[12px] font-medium text-[var(--text-secondary)] mb-1 block';
  const sectionCls = 'p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
            {es ? 'Single Sign-On (SSO)' : 'Single Sign-On (SSO)'}
          </h3>
        </div>
        <button
          onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
            config.enabled
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] ring-1 ring-[var(--border-subtle)]'
          }`}
        >
          {config.enabled ? (es ? 'Activo' : 'Enabled') : (es ? 'Inactivo' : 'Disabled')}
        </button>
      </div>

      {/* Provider Type */}
      <div className={sectionCls}>
        <label className={labelCls}>{es ? 'Tipo de proveedor' : 'Provider Type'}</label>
        <div className="flex gap-2">
          {(['saml', 'oidc'] as const).map(p => (
            <button
              key={p}
              onClick={() => setConfig({ ...config, provider: p })}
              className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition ${
                config.provider === p
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]'
              }`}
            >
              {p === 'saml' ? 'SAML 2.0' : 'OpenID Connect'}
            </button>
          ))}
        </div>

        <div>
          <label className={labelCls}>{es ? 'Nombre del proveedor' : 'Provider Name'}</label>
          <input
            value={config.providerName}
            onChange={e => setConfig({ ...config, providerName: e.target.value })}
            placeholder={config.provider === 'saml' ? 'Okta, Azure AD...' : 'Auth0, Google Workspace...'}
            className={inputCls}
          />
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {es ? 'Se muestra en el boton de login' : 'Shown on the login button'}
          </p>
        </div>
      </div>

      {/* SAML Config */}
      {config.provider === 'saml' && (
        <div className={sectionCls}>
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">
            {es ? 'Configuracion SAML' : 'SAML Configuration'}
          </p>

          <div>
            <label className={labelCls}>{es ? 'Entity ID (SP)' : 'Entity ID (SP)'}</label>
            <input
              value={config.entityId || ''}
              onChange={e => setConfig({ ...config, entityId: e.target.value })}
              placeholder="https://your-app.com/api/auth/sso/metadata"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{es ? 'URL de SSO (IdP)' : 'SSO URL (IdP)'}</label>
            <input
              value={config.ssoUrl || ''}
              onChange={e => setConfig({ ...config, ssoUrl: e.target.value })}
              placeholder="https://idp.example.com/saml/sso"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{es ? 'Certificado X.509 (IdP)' : 'X.509 Certificate (IdP)'}</label>
            <textarea
              value={config.certificate || ''}
              onChange={e => setConfig({ ...config, certificate: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              rows={5}
              className={`${inputCls} h-auto py-2 font-mono text-[11px] resize-y`}
            />
          </div>

          {/* SP Metadata */}
          <div className="flex items-center gap-2 pt-2">
            <a
              href="/api/auth/sso/metadata"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[12px] text-[var(--accent)] hover:opacity-80 transition ring-1 ring-[var(--border-subtle)]"
            >
              <Download className="h-3.5 w-3.5" />
              {es ? 'Descargar metadatos SP' : 'Download SP Metadata'}
            </a>
            <button
              onClick={copyMetadataUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition ring-1 ring-[var(--border-subtle)]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? (es ? 'Copiado' : 'Copied') : (es ? 'Copiar URL' : 'Copy URL')}
            </button>
          </div>
        </div>
      )}

      {/* OIDC Config */}
      {config.provider === 'oidc' && (
        <div className={sectionCls}>
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">
            {es ? 'Configuracion OpenID Connect' : 'OpenID Connect Configuration'}
          </p>

          <div>
            <label className={labelCls}>Client ID</label>
            <input
              value={config.clientId || ''}
              onChange={e => setConfig({ ...config, clientId: e.target.value })}
              placeholder="your-client-id"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Client Secret</label>
            <input
              type="password"
              value={config.clientSecret || ''}
              onChange={e => setConfig({ ...config, clientSecret: e.target.value })}
              placeholder="your-client-secret"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Issuer</label>
            <input
              value={config.issuer || ''}
              onChange={e => setConfig({ ...config, issuer: e.target.value })}
              placeholder="https://accounts.google.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Discovery URL</label>
            <input
              value={config.discoveryUrl || ''}
              onChange={e => setConfig({ ...config, discoveryUrl: e.target.value })}
              placeholder="https://accounts.google.com/.well-known/openid-configuration"
              className={inputCls}
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              {es ? 'Opcional si el Issuer esta configurado' : 'Optional if Issuer is set'}
            </p>
          </div>

          {/* Callback URL info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-secondary)]">
            <ExternalLink className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                {es ? 'URL de callback (agregar al IdP)' : 'Callback URL (add to IdP)'}
              </p>
              <code className="text-[11px] text-[var(--text-muted)] font-mono">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/sso/callback
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Attribute Mapping */}
      <div className={sectionCls}>
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">
          {es ? 'Mapeo de atributos' : 'Attribute Mapping'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{es ? 'Atributo de email' : 'Email Attribute'}</label>
            <input
              value={config.attributeMapping.email}
              onChange={e => setConfig({ ...config, attributeMapping: { ...config.attributeMapping, email: e.target.value } })}
              placeholder="email"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{es ? 'Atributo de nombre' : 'Display Name Attribute'}</label>
            <input
              value={config.attributeMapping.displayName}
              onChange={e => setConfig({ ...config, attributeMapping: { ...config.attributeMapping, displayName: e.target.value } })}
              placeholder="name"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>{es ? 'Atributo de rol (opcional)' : 'Role Attribute (optional)'}</label>
          <input
            value={config.attributeMapping.role || ''}
            onChange={e => setConfig({ ...config, attributeMapping: { ...config.attributeMapping, role: e.target.value || undefined } })}
            placeholder="role"
            className={inputCls}
          />
        </div>
      </div>

      {/* Provisioning */}
      <div className={sectionCls}>
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">
          {es ? 'Aprovisionamiento' : 'Provisioning'}
        </p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[var(--text-primary)]">
              {es ? 'Aprovisionamiento automatico' : 'Auto-provision users'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {es ? 'Crear usuarios y miembros automaticamente al primer login SSO' : 'Automatically create users and org members on first SSO login'}
            </p>
          </div>
          <button
            onClick={() => setConfig({ ...config, autoProvision: !config.autoProvision })}
            className={`w-10 h-5 rounded-full transition relative ${config.autoProvision ? 'bg-[var(--accent)]' : 'bg-[var(--bg-secondary)] ring-1 ring-[var(--border-subtle)]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${config.autoProvision ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {config.autoProvision && (
          <div>
            <label className={labelCls}>{es ? 'Rol por defecto' : 'Default Role'}</label>
            <select
              value={config.defaultRole}
              onChange={e => setConfig({ ...config, defaultRole: e.target.value })}
              className={inputCls}
            >
              <option value="member">Member</option>
              <option value="guest">Guest</option>
              <option value="readonly">Read-only</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        )}
      </div>

      {/* Allowed Domains */}
      <div className={sectionCls}>
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">
          {es ? 'Dominios permitidos' : 'Allowed Domains'}
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {es ? 'Si esta vacio, se permiten todos los dominios' : 'If empty, all domains are allowed'}
        </p>

        <div className="flex items-center gap-2">
          <input
            value={newDomain}
            onChange={e => { setNewDomain(e.target.value); setDomainError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
            placeholder="example.com"
            className={`flex-1 ${inputCls}`}
          />
          <button
            onClick={handleAddDomain}
            className="h-9 px-3 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {domainError && <p className="text-[11px] text-red-400">{domainError}</p>}

        <div className="space-y-1">
          {config.allowedDomains.map((domain, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] group">
              <code className="text-[13px] text-[var(--text-primary)] flex-1 font-mono">{domain}</code>
              <button
                onClick={() => handleRemoveDomain(i)}
                className="p-1 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <Check className="h-4 w-4 text-emerald-400" />
          <p className="text-[12px] text-emerald-300">{success}</p>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-xl ${testResult.ok ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
          {testResult.ok ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-red-400" />}
          <p className={`text-[12px] ${testResult.ok ? 'text-emerald-300' : 'text-red-300'}`}>{testResult.msg}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {es ? 'Guardar' : 'Save'}
        </button>
        {config.enabled && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[13px] font-medium hover:opacity-90 transition flex items-center gap-2 ring-1 ring-[var(--border-subtle)] disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {es ? 'Probar conexion' : 'Test Connection'}
          </button>
        )}
      </div>
    </div>
  );
}
