'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getWebhookLogs } from '@/lib/integrations-db';

interface Props {
  webhookId: string;
}

export default function WebhookLogs({ webhookId }: Props) {
  const { t } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getWebhookLogs(webhookId);
      setLogs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [webhookId]);

  const formatDate = (d: any) => {
    if (!d) return '-';
    const date = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
    return date.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-[var(--error)]" />;
    return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-xs text-[var(--text-muted)]">{t('integ.logs.noLogs')}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t('integ.logs.title')}
        </h4>
        <button onClick={load} className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors">
          <RefreshCw className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="space-y-1.5">
        {logs.map((log: any, i: number) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-base)] text-xs"
          >
            <StatusIcon status={log.status} />
            <span className="text-[var(--text-muted)] w-28 shrink-0">{formatDate(log.createdAt)}</span>
            <span className="text-[var(--text-secondary)] flex-1 truncate">{log.event}</span>
            {log.statusCode && (
              <span className={`font-mono ${log.statusCode >= 200 && log.statusCode < 300 ? 'text-green-500' : 'text-[var(--error)]'}`}>
                {log.statusCode}
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
              log.status === 'success' ? 'bg-green-500/10 text-green-500' :
              log.status === 'failed' ? 'bg-[var(--error)]/10 text-[var(--error)]' :
              'bg-amber-500/10 text-amber-500'
            }`}>
              {t(`integ.logs.${log.status}`)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
