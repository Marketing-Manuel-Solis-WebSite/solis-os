'use client';
import { useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Check, AlertTriangle, ChevronRight, Download, FileText } from 'lucide-react';
import {
  parseCSV,
  autoDetectMapping,
  validateAndTransform,
  batchImportTasks,
  createImportLog,
  MAPPABLE_FIELDS,
  type ColumnMapping,
  type ImportError,
} from '@/lib/import-csv';
import { ORG } from '@/lib/db';

// ─── Types ─────────────────────────────────────────────────

type Step = 'upload' | 'map' | 'preview' | 'confirm' | 'progress' | 'results';

interface Props {
  members: any[];
  teamId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onComplete: () => void;
}

// ─── Component ─────────────────────────────────────────────

export default function ImportWizard({ members, teamId, userId, userName, onClose, onComplete }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('upload');

  // Data state
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [dryRun, setDryRun] = useState(false);

  // Progress state
  const [importedCount, setImportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [resultErrors, setResultErrors] = useState<ImportError[]>([]);

  // ─── Step 1: Upload ────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB limit

    try {
      const { headers: h, rows: r } = await parseCSV(file);
      setFileName(file.name);
      setHeaders(h);
      setRows(r);
      setMapping(autoDetectMapping(h));
      setStep('map');
    } catch (err) {
      console.error('[Import] CSV parse failed:', err);
      setResultErrors([{ row: 0, field: '', value: '', message: t('import.parseError') }]);
      setStep('results');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ─── Step 2: Map columns ──────────────────────────────

  const updateMapping = (csvHeader: string, fieldId: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (fieldId === '') {
        delete next[csvHeader];
      } else {
        next[csvHeader] = fieldId;
      }
      return next;
    });
  };

  const hasTitleMapped = Object.values(mapping).includes('title');

  const handleMapNext = () => {
    const result = validateAndTransform(rows, mapping, members, {
      teamId: teamId === '__all__' ? '' : teamId,
      createdBy: userId,
    });
    setTasks(result.tasks);
    setErrors(result.errors);
    setStep('preview');
  };

  // ─── Step 4: Import ───────────────────────────────────

  const handleImport = async () => {
    setStep('progress');
    setImporting(true);
    setTotalCount(tasks.length);
    setImportedCount(0);

    try {
      if (!dryRun) {
        await batchImportTasks(tasks, (imported, total) => {
          setImportedCount(imported);
          setTotalCount(total);
        });
      }

      // Log the import
      await createImportLog({
        orgId: ORG,
        entityType: 'task',
        fileName,
        totalRows: rows.length,
        importedCount: dryRun ? 0 : tasks.length,
        skippedCount: rows.length - tasks.length,
        errors: errors.slice(0, 50),
        columnMapping: mapping,
        importedBy: userId,
        importedByName: userName,
        teamId: teamId === '__all__' ? '' : teamId,
        dryRun,
      });

      setResultErrors(errors);
      setImportedCount(dryRun ? 0 : tasks.length);
      setStep('results');
    } catch (err) {
      console.error('[Import] Import failed:', err);
      setResultErrors([{ row: 0, field: '', value: '', message: t('import.importFailed') }]);
      setStep('results');
    } finally {
      setImporting(false);
    }
  };

  // ─── Template download ─────────────────────────────────

  const downloadTemplate = () => {
    const headers = MAPPABLE_FIELDS.map(f => f.id);
    const sampleRow = ['Mi tarea ejemplo', 'Descripción de la tarea', 'todo', 'medium', 'task', '', 'etiqueta1,etiqueta2', '2026-04-01', '', '60', '5', 'team'];
    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solis-tasks-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render steps ──────────────────────────────────────

  const renderUpload = () => (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-[var(--border)] rounded-2xl p-12 text-center hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all cursor-pointer"
        onClick={() => document.getElementById('csv-file-input')?.click()}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-[14px] font-medium text-[var(--text-secondary)] mb-1">
          {t('import.dropOrClick')}
        </p>
        <p className="text-[12px] text-[var(--text-muted)]">
          CSV, {t('import.maxSize')}
        </p>
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      <button
        onClick={downloadTemplate}
        className="flex items-center gap-2 mx-auto text-[13px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition"
      >
        <Download className="h-3.5 w-3.5" />
        {t('import.downloadTemplate')}
      </button>
    </div>
  );

  const renderMap = () => (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--text-muted)] mb-2">
        {t('import.mapDescription')} ({rows.length} {t('import.rows')})
      </p>

      <div className="max-h-[350px] overflow-y-auto space-y-2">
        {headers.map(header => (
          <div key={header} className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--text-secondary)] w-40 truncate shrink-0 font-medium">
              {header}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
            <select
              value={mapping[header] || ''}
              onChange={e => updateMapping(header, e.target.value)}
              className="flex-1 h-8 px-2 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] focus:border-[var(--accent)]"
            >
              <option value="">{t('import.skip')}</option>
              {MAPPABLE_FIELDS.map(f => (
                <option key={f.id} value={f.id} disabled={Object.values(mapping).includes(f.id) && mapping[header] !== f.id}>
                  {f.label} {f.required ? '*' : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-3">
        <button onClick={() => setStep('upload')} className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          {t('common.back')}
        </button>
        <button
          onClick={handleMapNext}
          disabled={!hasTitleMapped}
          className="h-9 px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium text-[13px] disabled:opacity-40 transition"
        >
          {t('import.preview')}
        </button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="flex items-center gap-1 text-emerald-400">
          <Check className="h-3.5 w-3.5" /> {tasks.length} {t('import.valid')}
        </span>
        {errors.length > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {errors.length} {t('import.warnings')}
          </span>
        )}
      </div>

      {/* Preview table */}
      <div className="max-h-[280px] overflow-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[var(--bg-elevated)]">
            <tr>
              <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">#</th>
              <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">{t('import.titleCol')}</th>
              <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">Status</th>
              <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">{t('import.priorityCol')}</th>
              <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">Tags</th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(0, 10).map((task, i) => (
              <tr key={i} className="border-t border-[var(--border-subtle)]">
                <td className="px-3 py-2 text-[var(--text-muted)]">{i + 1}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] font-medium max-w-[200px] truncate">{task.title}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{task.status}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{task.priority}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{task.tags?.join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length > 10 && (
          <p className="text-center text-[11px] text-[var(--text-muted)] py-2">
            +{tasks.length - 10} {t('import.moreRows')}
          </p>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="max-h-[120px] overflow-auto rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
          <p className="text-[12px] font-medium text-amber-400 mb-1">{t('import.validationErrors')}</p>
          {errors.slice(0, 10).map((err, i) => (
            <p key={i} className="text-[11px] text-[var(--text-muted)]">
              Row {err.row}: {err.field} = &quot;{err.value}&quot; — {err.message}
            </p>
          ))}
          {errors.length > 10 && (
            <p className="text-[11px] text-[var(--text-muted)]">+{errors.length - 10} more...</p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={() => setStep('map')} className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          {t('common.back')}
        </button>
        <button
          onClick={() => setStep('confirm')}
          disabled={tasks.length === 0}
          className="h-9 px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium text-[13px] disabled:opacity-40 transition"
        >
          {t('import.continue')}
        </button>
      </div>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--bg-elevated)] p-5 space-y-3">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="text-[14px] font-medium text-[var(--text-primary)]">{fileName}</p>
            <p className="text-[12px] text-[var(--text-muted)]">
              {tasks.length} {t('import.tasksToImport')} · {errors.length} {t('import.skipped')}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-[13px] text-[var(--text-secondary)]">{t('import.dryRun')}</span>
        </label>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={() => setStep('preview')} className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          {t('common.back')}
        </button>
        <button
          onClick={handleImport}
          className="h-9 px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium text-[13px] transition"
        >
          {dryRun ? t('import.validate') : t('import.importNow')}
        </button>
      </div>
    </div>
  );

  const renderProgress = () => {
    const pct = totalCount > 0 ? Math.round((importedCount / totalCount) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="w-full max-w-xs">
          <div className="h-2 rounded-full bg-[var(--border-default)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)]">
          {t('import.importing')} {importedCount}/{totalCount}...
        </p>
      </div>
    );
  };

  const renderResults = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-6">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
          <Check className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-[16px] font-semibold text-[var(--text-primary)]">{t('import.complete')}</p>
        <p className="text-[13px] text-[var(--text-muted)] mt-1">
          {dryRun
            ? t('import.dryRunResult', { valid: tasks.length, errors: resultErrors.length })
            : t('import.importResult', { count: importedCount, errors: resultErrors.length })
          }
        </p>
      </div>

      {resultErrors.length > 0 && (
        <div className="max-h-[150px] overflow-auto rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
          <p className="text-[12px] font-medium text-amber-400 mb-1">{t('import.skippedRows')}</p>
          {resultErrors.slice(0, 15).map((err, i) => (
            <p key={i} className="text-[11px] text-[var(--text-muted)]">
              Row {err.row}: {err.message}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button
          onClick={() => { onComplete(); onClose(); }}
          className="h-9 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium text-[13px] transition"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );

  // ─── Step titles ────────────────────────────────────────

  const stepTitles: Record<Step, string> = {
    upload: t('import.upload'),
    map: t('import.mapColumns'),
    preview: t('import.preview'),
    confirm: t('import.confirm'),
    progress: t('import.importing'),
    results: t('import.results'),
  };

  const stepNumbers: Step[] = ['upload', 'map', 'preview', 'confirm', 'progress', 'results'];
  const currentStepIndex = stepNumbers.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[620px] max-h-[85vh] overflow-y-auto bg-[var(--bg-base)] rounded-2xl shadow-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--text-primary)]">{t('import.title')}</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{stepTitles[step]}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3">
          {stepNumbers.slice(0, 4).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStepIndex ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]'
              }`} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {step === 'upload' && renderUpload()}
              {step === 'map' && renderMap()}
              {step === 'preview' && renderPreview()}
              {step === 'confirm' && renderConfirm()}
              {step === 'progress' && renderProgress()}
              {step === 'results' && renderResults()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
