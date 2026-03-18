'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Clock, RotateCcw, Eye, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { getRevisions, getRevision, type DocRevision } from '@/lib/doc-versions';
import { renderMarkdown } from '@/lib/markdown';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';

interface DocVersionHistoryProps {
  docId: string;
  currentVersion: number;
  onRestore: (revision: DocRevision) => void;
  onClose: () => void;
}

export default function DocVersionHistory({ docId, currentVersion, onRestore, onClose }: DocVersionHistoryProps) {
  const { t } = useI18n();
  const [revisions, setRevisions] = useState<DocRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocRevision | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const revs = await getRevisions(docId);
      setRevisions(revs);
    } catch (err) {
      console.error('[DocVersionHistory] Failed to load revisions:', err);
      setRevisions([]);
    }
    setLoading(false);
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  const handlePreview = async (rev: DocRevision) => {
    setSelected(rev);
    setPreviewing(true);
  };

  const handleRestore = () => {
    if (!selected) return;
    onRestore(selected);
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatRelative = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('docVersion.justNow');
    if (mins < 60) return t('docVersion.minutesAgo', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('docVersion.hoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    return t('docVersion.daysAgo', { n: days });
  };

  return (
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="w-[360px] h-full bg-[var(--bg-base)] border-l border-[var(--border-subtle)] flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('docVersion.title')}</h3>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            v{currentVersion}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        ) : revisions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">{t('docVersion.noVersions')}</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">{t('docVersion.noVersionsHint')}</p>
          </div>
        ) : previewing && selected ? (
          /* Preview mode */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-tertiary)]/50 border-b border-[var(--border-subtle)]">
              <button onClick={() => setPreviewing(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                v{selected.version}
              </span>
              <span className="text-[12px] text-[var(--text-muted)]">
                {formatDate(selected.createdAt)}
              </span>
              <div className="flex-1" />
              <button onClick={handleRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition">
                <RotateCcw className="h-3 w-3" /> {t('docVersion.restore')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{selected.title}</h4>
              <div className="doc-preview text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(selected.content || '')) }} />
            </div>
          </div>
        ) : (
          /* Version list */
          <div className="p-2">
            {revisions.map((rev, i) => (
              <button
                key={rev.id}
                onClick={() => handlePreview(rev)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-[var(--accent)]">v{rev.version}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{formatRelative(rev.createdAt)}</span>
                  {i === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium">
                      {t('docVersion.latest')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[var(--text-secondary)] truncate">{rev.title}</span>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0">{rev.wordCount}w</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[var(--text-muted)]">{rev.editedByName}</span>
                  {rev.changeNote && (
                    <span className="text-[11px] text-[var(--text-muted)] italic truncate">— {rev.changeNote}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition">
                  <Eye className="h-3 w-3 text-[var(--text-muted)]" />
                  <span className="text-[11px] text-[var(--text-muted)]">{t('docVersion.preview')}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
        {revisions.length} {t('docVersion.versionsStored')} · {t('docVersion.max50')}
      </div>
    </motion.aside>
  );
}
