'use client';

// ================================================================
// Billable Rates Config — Admin panel to set rates per user/role
// ================================================================

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import {
  DollarSign, Save, Loader2, User, Plus, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface RateEntry {
  userId: string;
  displayName?: string;
  ratePerHour: number;
  currency: string;
}

interface Props {
  rates: RateEntry[];
  members?: { id: string; displayName: string }[];
  onSave: (rates: RateEntry[]) => Promise<void>;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'BRL', 'COP', 'ARS'];

export default function BillableRatesConfig({ rates: initialRates, members = [], onSave }: Props) {
  const { lang } = useI18n();
  const toast = useToast();

  const [rates, setRates] = useState<RateEntry[]>(initialRates);
  const [saving, setSaving] = useState(false);

  const addRate = () => {
    setRates(prev => [...prev, { userId: '', ratePerHour: 0, currency: 'USD' }]);
  };

  const removeRate = (index: number) => {
    setRates(prev => prev.filter((_, i) => i !== index));
  };

  const updateRate = (index: number, field: keyof RateEntry, value: any) => {
    setRates(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    const validRates = rates.filter(r => r.userId && r.ratePerHour > 0);
    if (validRates.length === 0) {
      toast.error(lang === 'es' ? 'Configura al menos una tarifa' : 'Set at least one rate');
      return;
    }

    setSaving(true);
    try {
      await onSave(validRates);
      toast.success(
        lang === 'es' ? 'Tarifas guardadas' : 'Rates saved',
        lang === 'es' ? `${validRates.length} tarifas actualizadas` : `${validRates.length} rates updated`,
      );
    } catch (err: any) {
      toast.error(
        lang === 'es' ? 'Error al guardar' : 'Failed to save',
        err.message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {lang === 'es' ? 'Tarifas por hora' : 'Billable Rates'}
          </h3>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {lang === 'es' ? 'Guardar' : 'Save'}
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_120px_100px_40px] gap-3 px-1">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {lang === 'es' ? 'Usuario' : 'User'}
        </span>
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {lang === 'es' ? 'Tarifa/hora' : 'Rate/hour'}
        </span>
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {lang === 'es' ? 'Moneda' : 'Currency'}
        </span>
        <span />
      </div>

      {/* Rate rows */}
      <AnimatePresence mode="popLayout">
        {rates.map((rate, index) => (
          <motion.div
            key={index}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-[1fr_120px_100px_40px] gap-3 items-center"
          >
            {/* User selector */}
            {members.length > 0 ? (
              <select
                value={rate.userId}
                onChange={e => updateRate(index, 'userId', e.target.value)}
                className="h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
              >
                <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={rate.userId}
                  onChange={e => updateRate(index, 'userId', e.target.value)}
                  placeholder="User ID"
                  className="flex-1 h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
              </div>
            )}

            {/* Rate input */}
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate.ratePerHour || ''}
              onChange={e => updateRate(index, 'ratePerHour', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
            />

            {/* Currency selector */}
            <select
              value={rate.currency}
              onChange={e => updateRate(index, 'currency', e.target.value)}
              className="h-10 px-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
            >
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Delete button */}
            <button
              onClick={() => removeRate(index)}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add button */}
      <button
        onClick={addRate}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[var(--border-subtle)] text-sm font-medium text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        {lang === 'es' ? 'Agregar tarifa' : 'Add rate'}
      </button>

      {/* Summary */}
      {rates.length > 0 && (
        <p className="text-[12px] text-[var(--text-muted)]">
          {lang === 'es'
            ? `${rates.filter(r => r.userId && r.ratePerHour > 0).length} tarifas configuradas`
            : `${rates.filter(r => r.userId && r.ratePerHour > 0).length} rates configured`}
        </p>
      )}
    </div>
  );
}
