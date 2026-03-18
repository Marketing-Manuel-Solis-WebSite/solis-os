'use client';

import { useState } from 'react';
import { Shield, Plus, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { isValidCidr, formatIpRange } from '@/lib/security/ip-allowlist';

interface Props {
  enabled: boolean;
  ranges: string[];
  onSave: (enabled: boolean, ranges: string[]) => void;
}

export default function IpAllowlistManager({ enabled, ranges, onSave }: Props) {
  const { lang } = useI18n();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [ipRanges, setIpRanges] = useState<string[]>(ranges);
  const [newRange, setNewRange] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!newRange.trim()) return;
    if (!isValidCidr(newRange.trim())) {
      setError(lang === 'es' ? 'Formato inválido. Usa: 192.168.1.0/24 o 10.0.0.1' : 'Invalid format. Use: 192.168.1.0/24 or 10.0.0.1');
      return;
    }
    if (ipRanges.includes(newRange.trim())) {
      setError(lang === 'es' ? 'Este rango ya existe' : 'This range already exists');
      return;
    }
    setIpRanges([...ipRanges, newRange.trim()]);
    setNewRange('');
    setError('');
  };

  const handleRemove = (idx: number) => {
    setIpRanges(ipRanges.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave(isEnabled, ipRanges);
  };

  const hasChanges = isEnabled !== enabled || JSON.stringify(ipRanges) !== JSON.stringify(ranges);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">
            {lang === 'es' ? 'Lista de IPs permitidas' : 'IP Allowlist'}
          </span>
        </div>
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
            isEnabled
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] ring-1 ring-[var(--border-subtle)]'
          }`}
        >
          {isEnabled ? (lang === 'es' ? 'Activo' : 'Active') : (lang === 'es' ? 'Inactivo' : 'Inactive')}
        </button>
      </div>

      {isEnabled && (
        <>
          {/* Warning */}
          {ipRanges.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-300">
                {lang === 'es'
                  ? 'Sin rangos configurados. Si activas sin rangos, nadie podrá acceder.'
                  : 'No ranges configured. Enabling with no ranges will block all access.'}
              </p>
            </div>
          )}

          {/* Add range */}
          <div className="flex items-center gap-2">
            <input
              value={newRange}
              onChange={e => { setNewRange(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="192.168.1.0/24"
              className="flex-1 h-8 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)]"
            />
            <button
              onClick={handleAdd}
              className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}

          {/* Range list */}
          <div className="space-y-1">
            {ipRanges.map((range, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] group">
                <code className="text-[13px] text-[var(--text-primary)] flex-1 font-mono">{formatIpRange(range)}</code>
                <button
                  onClick={() => handleRemove(i)}
                  className="p-1 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Save */}
      {hasChanges && (
        <button
          onClick={handleSave}
          className="w-full py-2 rounded-xl bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
        >
          <Check className="h-4 w-4" />
          {lang === 'es' ? 'Guardar cambios' : 'Save changes'}
        </button>
      )}
    </div>
  );
}
