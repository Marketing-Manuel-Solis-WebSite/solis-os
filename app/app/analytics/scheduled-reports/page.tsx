'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Mail, Plus, Trash2, ToggleLeft, ToggleRight,
  Loader2, FileText, Download, ChevronRight, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useFeatureFlag } from '@/lib/feature-flags';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';

interface ScheduledReport {
  id: string;
  name: string;
  entity: string;
  format: string;
  frequency: string;
  recipients: string[];
  active: boolean;
  lastSentAt: string | null;
  nextRunAt: string;
  createdBy: string;
}

const ENTITIES = [
  { value: 'tasks', labelEs: 'Tareas', labelEn: 'Tasks' },
  { value: 'goals', labelEs: 'Objetivos', labelEn: 'Goals' },
  { value: 'time-entries', labelEs: 'Tiempo', labelEn: 'Time entries' },
];

const FREQUENCIES = [
  { value: 'daily', labelEs: 'Diario', labelEn: 'Daily' },
  { value: 'weekly', labelEs: 'Semanal', labelEn: 'Weekly' },
  { value: 'monthly', labelEs: 'Mensual', labelEn: 'Monthly' },
];

function getNextRunDate(frequency: string): string {
  const now = new Date();
  if (frequency === 'daily') {
    now.setDate(now.getDate() + 1);
    now.setHours(8, 0, 0, 0);
  } else if (frequency === 'weekly') {
    now.setDate(now.getDate() + (7 - now.getDay() + 1)); // Next Monday
    now.setHours(8, 0, 0, 0);
  } else {
    now.setMonth(now.getMonth() + 1, 1);
    now.setHours(8, 0, 0, 0);
  }
  return now.toISOString();
}

export default function ScheduledReportsPage() {
  const { user, me, can } = useAuth();
  const { lang } = useI18n();
  const enabled = useFeatureFlag('scheduled-reports');

  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [entity, setEntity] = useState('tasks');
  const [format, setFormat] = useState('csv');
  const [frequency, setFrequency] = useState('weekly');
  const [recipients, setRecipients] = useState('');
  const [saving, setSaving] = useState(false);

  const orgId = getCurrentOrgId();
  const colRef = collection(db, `orgs/${orgId}/scheduledReports`);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduledReport)));
    } catch {
      setReports([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleCreate = async () => {
    if (!name.trim() || !recipients.trim()) return;
    setSaving(true);
    try {
      const emails = recipients.split(',').map(e => e.trim()).filter(Boolean);
      await addDoc(colRef, {
        orgId,
        name: name.trim(),
        entity,
        format,
        frequency,
        recipients: emails,
        active: true,
        lastSentAt: null,
        nextRunAt: getNextRunDate(frequency),
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowCreate(false);
      setName('');
      setRecipients('');
      loadReports();
    } catch (err) {
      console.error('Failed to create report:', err);
    }
    setSaving(false);
  };

  const handleToggle = async (report: ScheduledReport) => {
    await updateDoc(doc(db, `orgs/${orgId}/scheduledReports/${report.id}`), {
      active: !report.active,
      updatedAt: serverTimestamp(),
    });
    loadReports();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'es' ? 'Eliminar este reporte?' : 'Delete this report?')) return;
    await deleteDoc(doc(db, `orgs/${orgId}/scheduledReports/${id}`));
    loadReports();
  };

  if (!enabled) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <AlertCircle className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">
          {lang === 'es' ? 'Reportes programados no está habilitado' : 'Scheduled reports is not enabled'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[var(--accent)]" />
            {lang === 'es' ? 'Reportes programados' : 'Scheduled Reports'}
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-0.5">
            {lang === 'es' ? 'Recibe reportes automáticos por email' : 'Receive automatic reports by email'}
          </p>
        </div>
        {can('analytics', 'create') && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" />
            {lang === 'es' ? 'Nuevo reporte' : 'New report'}
          </button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Nombre' : 'Name'}
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={lang === 'es' ? 'Reporte semanal de tareas...' : 'Weekly task report...'}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Datos' : 'Data'}
                  </label>
                  <select value={entity} onChange={e => setEntity(e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]">
                    {ENTITIES.map(e => <option key={e.value} value={e.value}>{lang === 'es' ? e.labelEs : e.labelEn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Frecuencia' : 'Frequency'}
                  </label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)]">
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{lang === 'es' ? f.labelEs : f.labelEn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                    {lang === 'es' ? 'Formato' : 'Format'}
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setFormat('csv')} className={`flex-1 h-9 rounded-lg text-[13px] font-medium transition ${format === 'csv' ? 'bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>CSV</button>
                    <button onClick={() => setFormat('pdf')} className={`flex-1 h-9 rounded-lg text-[13px] font-medium transition ${format === 'pdf' ? 'bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>PDF</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-1 block">
                  {lang === 'es' ? 'Destinatarios (emails separados por coma)' : 'Recipients (comma-separated emails)'}
                </label>
                <input
                  value={recipients}
                  onChange={e => setRecipients(e.target.value)}
                  placeholder="user@example.com, other@example.com"
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button onClick={handleCreate} disabled={saving || !name.trim() || !recipients.trim()} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[13px] font-medium disabled:opacity-50 hover:opacity-90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === 'es' ? 'Crear' : 'Create')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20 rounded-2xl bg-[var(--bg-secondary)]">
          <Mail className="h-10 w-10 text-[var(--text-muted)]/20 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">
            {lang === 'es' ? 'Sin reportes programados' : 'No scheduled reports'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(report => (
            <div
              key={report.id}
              className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition group"
            >
              <div className={`p-2 rounded-lg ${report.active ? 'bg-[var(--accent-subtle)]' : 'bg-[var(--bg-secondary)]'}`}>
                <FileText className={`h-4 w-4 ${report.active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{report.name}</p>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                  <span className="capitalize">{report.entity}</span>
                  <span>·</span>
                  <span className="uppercase">{report.format}</span>
                  <span>·</span>
                  <span className="capitalize">{report.frequency}</span>
                  <span>·</span>
                  <span>{report.recipients.length} recipient(s)</span>
                </div>
              </div>

              {report.lastSentAt && (
                <div className="text-[11px] text-[var(--text-muted)] text-right">
                  <div>{lang === 'es' ? 'Último envío' : 'Last sent'}</div>
                  <div>{new Date(report.lastSentAt).toLocaleDateString()}</div>
                </div>
              )}

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => handleToggle(report)}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"
                  title={report.active ? 'Disable' : 'Enable'}
                >
                  {report.active
                    ? <ToggleRight className="h-5 w-5 text-[var(--accent)]" />
                    : <ToggleLeft className="h-5 w-5 text-[var(--text-muted)]" />
                  }
                </button>
                <button
                  onClick={() => handleDelete(report.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
