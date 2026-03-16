'use client';

// ================================================================
// Scheduled Report Modal — Create/edit recurring report exports
// ================================================================

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CalendarClock, Loader2, FileText, CheckSquare, Clock, Activity,
  FileSpreadsheet, Printer, Plus, Trash2,
} from 'lucide-react';
import { useToast } from '@/components/notifications/toast-provider';
import {
  collection, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORG_ID as ORG } from '@/lib/org';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ExportEntity = 'tasks' | 'time_entries' | 'goals' | 'activity_logs';
type ReportFormat = 'csv' | 'pdf';
type Frequency = 'daily' | 'weekly' | 'monthly';

const ENTITIES: { id: ExportEntity; icon: typeof FileText; labelEn: string; labelEs: string; color: string }[] = [
  { id: 'tasks', icon: CheckSquare, labelEn: 'Tasks', labelEs: 'Tareas', color: '#22C55E' },
  { id: 'time_entries', icon: Clock, labelEn: 'Time Entries', labelEs: 'Registros de tiempo', color: '#3B82F6' },
  { id: 'goals', icon: FileText, labelEn: 'Goals', labelEs: 'Metas', color: '#8B5CF6' },
  { id: 'activity_logs', icon: Activity, labelEn: 'Activity Logs', labelEs: 'Registro de actividad', color: '#F59E0B' },
];

const FREQUENCIES: { id: Frequency; labelEn: string; labelEs: string }[] = [
  { id: 'daily', labelEn: 'Daily', labelEs: 'Diario' },
  { id: 'weekly', labelEn: 'Weekly', labelEs: 'Semanal' },
  { id: 'monthly', labelEn: 'Monthly', labelEs: 'Mensual' },
];

function computeNextRunAt(frequency: Frequency): string {
  const d = new Date();
  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(6, 0, 0, 0);
      return d.toISOString();
    case 'weekly': {
      const dayOfWeek = d.getUTCDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
      d.setUTCDate(d.getUTCDate() + daysUntilMonday);
      d.setUTCHours(6, 0, 0, 0);
      return d.toISOString();
    }
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
      d.setUTCHours(6, 0, 0, 0);
      return d.toISOString();
  }
}

export default function ScheduledReportModal({ open, onClose }: Props) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [entity, setEntity] = useState<ExportEntity>('tasks');
  const [format, setFormat] = useState<ReportFormat>('csv');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const addRecipient = () => setRecipients(prev => [...prev, '']);
  const removeRecipient = (index: number) => setRecipients(prev => prev.filter((_, i) => i !== index));
  const updateRecipient = (index: number, value: string) => {
    setRecipients(prev => prev.map((r, i) => i === index ? value : r));
  };

  const handleSave = async () => {
    const validRecipients = recipients.filter(r => r.trim().length > 0);
    if (!name.trim()) {
      toast.error(lang === 'es' ? 'Nombre requerido' : 'Name required');
      return;
    }
    if (validRecipients.length === 0) {
      toast.error(lang === 'es' ? 'Al menos un destinatario' : 'At least one recipient required');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, `orgs/${ORG}/scheduledReports`), {
        orgId: ORG,
        name: name.trim(),
        entity,
        format,
        frequency,
        recipients: validRecipients,
        lastSentAt: null,
        nextRunAt: computeNextRunAt(frequency),
        active: true,
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success(
        lang === 'es' ? 'Reporte programado' : 'Report scheduled',
        lang === 'es' ? `Se enviará ${frequency === 'daily' ? 'diariamente' : frequency === 'weekly' ? 'semanalmente' : 'mensualmente'}` : `Will be sent ${frequency}`,
      );
      onClose();

      // Reset form
      setName('');
      setEntity('tasks');
      setFormat('csv');
      setFrequency('weekly');
      setRecipients(['']);
    } catch (err: any) {
      toast.error(
        lang === 'es' ? 'Error al programar' : 'Failed to schedule',
        err.message,
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg bg-[var(--bg-elevated)] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-[var(--accent)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {lang === 'es' ? 'Programar reporte' : 'Schedule Report'}
                </h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              {/* Report name */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  {lang === 'es' ? 'Nombre del reporte' : 'Report name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={lang === 'es' ? 'Ej: Reporte semanal de tareas' : 'E.g. Weekly tasks report'}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
              </div>

              {/* Entity selector */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  {lang === 'es' ? 'Tipo de datos' : 'Data type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ENTITIES.map(e => {
                    const Icon = e.icon;
                    const isActive = entity === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setEntity(e.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left ${
                          isActive
                            ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" style={{ color: e.color }} />
                        <span className={`text-sm font-medium ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                          {lang === 'es' ? e.labelEs : e.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format toggle */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  {lang === 'es' ? 'Formato' : 'Format'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormat('csv')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
                      format === 'csv'
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                        : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4" style={{ color: format === 'csv' ? 'var(--accent)' : 'var(--text-muted)' }} />
                    <span className={`text-sm font-medium ${format === 'csv' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>CSV</span>
                  </button>
                  <button
                    onClick={() => setFormat('pdf')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
                      format === 'pdf'
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                        : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <Printer className="h-4 w-4" style={{ color: format === 'pdf' ? 'var(--accent)' : 'var(--text-muted)' }} />
                    <span className={`text-sm font-medium ${format === 'pdf' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>PDF</span>
                  </button>
                </div>
              </div>

              {/* Frequency picker */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  {lang === 'es' ? 'Frecuencia' : 'Frequency'}
                </label>
                <div className="flex gap-2">
                  {FREQUENCIES.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFrequency(f.id)}
                      className={`px-4 py-2.5 rounded-xl border transition text-sm font-medium ${
                        frequency === f.id
                          ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {lang === 'es' ? f.labelEs : f.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients list */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  {lang === 'es' ? 'Destinatarios' : 'Recipients'}
                </label>
                <div className="space-y-2">
                  {recipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={r}
                        onChange={e => updateRecipient(i, e.target.value)}
                        placeholder="email@example.com"
                        className="flex-1 h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                      />
                      {recipients.length > 1 && (
                        <button
                          onClick={() => removeRecipient(i)}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addRecipient}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition"
                  >
                    <Plus className="h-3 w-3" /> {lang === 'es' ? 'Agregar destinatario' : 'Add recipient'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                {lang === 'es' ? 'Programar' : 'Schedule'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
