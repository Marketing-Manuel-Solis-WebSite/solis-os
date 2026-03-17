'use client';

// ================================================================
// Analytics Export Modal — Download CSV exports of org data
// ================================================================

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Loader2, FileText, CheckSquare, Clock, Activity, FileSpreadsheet, Printer } from 'lucide-react';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultEntity?: 'tasks' | 'time_entries' | 'goals' | 'activity_logs';
  defaultTeamId?: string;
}

type ExportEntity = 'tasks' | 'time_entries' | 'goals' | 'activity_logs';
type ExportFormat = 'csv' | 'pdf';

const FORMATS: { id: ExportFormat; icon: typeof FileText; labelEn: string; labelEs: string }[] = [
  { id: 'csv', icon: FileSpreadsheet, labelEn: 'CSV', labelEs: 'CSV' },
  { id: 'pdf', icon: Printer, labelEn: 'PDF', labelEs: 'PDF' },
];

const ENTITIES: { id: ExportEntity; icon: typeof FileText; labelEn: string; labelEs: string; color: string }[] = [
  { id: 'tasks', icon: CheckSquare, labelEn: 'Tasks', labelEs: 'Tareas', color: '#22C55E' },
  { id: 'time_entries', icon: Clock, labelEn: 'Time Entries', labelEs: 'Registros de tiempo', color: '#3B82F6' },
  { id: 'goals', icon: FileText, labelEn: 'Goals', labelEs: 'Metas', color: '#8B5CF6' },
  { id: 'activity_logs', icon: Activity, labelEn: 'Activity Logs', labelEs: 'Registro de actividad', color: '#F59E0B' },
];

export default function ExportModal({ open, onClose, defaultEntity, defaultTeamId }: Props) {
  const { lang } = useI18n();
  const { teams, activeTeamId } = useAuth();
  const toast = useToast();
  const [entity, setEntity] = useState<ExportEntity>(defaultEntity || 'tasks');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teamId, setTeamId] = useState(defaultTeamId || '');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams({ entity, format });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (teamId) params.set('teamId', teamId);

      const exportUrl = `/api/analytics/export?${params}`;

      // PDF: open in new window for print-to-PDF
      if (format === 'pdf') {
        const res = await fetch(exportUrl, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Export failed');
        }
        const html = await res.text();
        const rowCount = res.headers.get('X-Row-Count') || '0';
        const pdfWindow = window.open('', '_blank');
        if (pdfWindow) {
          pdfWindow.document.write(html);
          pdfWindow.document.close();
        }
        toast.success(
          lang === 'es' ? 'PDF generado' : 'PDF generated',
          lang === 'es' ? `${rowCount} filas — usa Ctrl+P para imprimir` : `${rowCount} rows — use Ctrl+P to print`,
        );
        onClose();
        return;
      }

      // CSV: download file
      const res = await fetch(exportUrl, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Export failed');
      }

      const blob = await res.blob();
      const rowCount = res.headers.get('X-Row-Count') || '0';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}_export.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        lang === 'es' ? 'Exportación completada' : 'Export complete',
        lang === 'es' ? `${rowCount} filas exportadas` : `${rowCount} rows exported`,
      );
      onClose();
    } catch (err: any) {
      toast.error(
        lang === 'es' ? 'Error al exportar' : 'Export failed',
        err.message,
      );
    } finally {
      setExporting(false);
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
            className="relative w-full max-w-lg bg-[var(--bg-elevated)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-[var(--accent)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {lang === 'es' ? 'Exportar datos' : 'Export Data'}
                </h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
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
                  {FORMATS.map(f => {
                    const FIcon = f.icon;
                    const isActive = format === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFormat(f.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
                          isActive
                            ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <FIcon className="h-4 w-4 shrink-0" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
                        <span className={`text-sm font-medium ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                          {lang === 'es' ? f.labelEs : f.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                    {lang === 'es' ? 'Desde' : 'From'}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                    {lang === 'es' ? 'Hasta' : 'To'}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
              </div>

              {/* Team filter */}
              {teams.length > 1 && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                    {lang === 'es' ? 'Equipo' : 'Team'}
                  </label>
                  <select
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  >
                    <option value="">{lang === 'es' ? 'Todos los equipos' : 'All teams'}</option>
                    {teams.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Info */}
              <p className="text-[12px] text-[var(--text-muted)]">
                {format === 'pdf'
                  ? (lang === 'es'
                    ? 'Se abrirá una ventana con los datos en formato tabla. Usa Ctrl+P para guardar como PDF.'
                    : 'A new window will open with the data as a table. Use Ctrl+P to save as PDF.')
                  : (lang === 'es'
                    ? 'Se descargará un archivo CSV con los datos seleccionados. Fechas vacías = sin filtro.'
                    : 'A CSV file will be downloaded with the selected data. Empty dates = no filter.')}
              </p>
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
                onClick={handleExport}
                disabled={exporting}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {format === 'pdf'
                  ? (lang === 'es' ? 'Exportar PDF' : 'Export PDF')
                  : (lang === 'es' ? 'Exportar CSV' : 'Export CSV')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
