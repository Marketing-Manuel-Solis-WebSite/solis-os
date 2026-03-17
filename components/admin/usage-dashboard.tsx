'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  collection, query, where, getCountFromServer, getDocs, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';
import {
  BarChart3, Users, Zap, Bot, FileText, FileInput, Clock, Mail,
  Database, Loader2, Key, Webhook,
} from 'lucide-react';

interface Metric {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  sublabel?: string;
}

export default function UsageDashboard() {
  const { allMembers, teams } = useAuth();
  const { t, lang } = useI18n();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    const orgId = getCurrentOrgId();
    try {
      const [
        automationsSnap,
        activeAutoSnap,
        autoLogsSnap,
        formsSnap,
        formSubsSnap,
        docsSnap,
        tasksSnap,
        reportsSnap,
        apiKeysSnap,
        webhooksSnap,
      ] = await Promise.all([
        getCountFromServer(query(collection(db, 'automations'), where('orgId', '==', orgId))),
        getCountFromServer(query(collection(db, 'automations'), where('orgId', '==', orgId), where('enabled', '==', true))),
        getCountFromServer(query(collection(db, `orgs/${orgId}/automationLogs`))),
        getCountFromServer(query(collection(db, 'forms'), where('orgId', '==', orgId))),
        getCountFromServer(query(collection(db, `orgs/${orgId}/formSubmissions`))),
        getCountFromServer(query(collection(db, 'docs'), where('orgId', '==', orgId))),
        getCountFromServer(query(collection(db, 'tasks'), where('orgId', '==', orgId))),
        getCountFromServer(query(collection(db, `orgs/${orgId}/scheduledReports`))),
        getCountFromServer(query(collection(db, `orgs/${orgId}/apiKeys`))),
        getCountFromServer(query(collection(db, `orgs/${orgId}/webhooks`))),
      ]);

      const activeMembers = (allMembers || []).filter((m: any) => m.active !== false).length;
      const guestCount = (allMembers || []).filter((m: any) => m.active !== false && (m.role === 'guest' || m.role === 'readonly')).length;

      const isEs = lang === 'es';

      setMetrics([
        { label: isEs ? 'Miembros activos' : 'Active Members', value: activeMembers, icon: Users, color: '#3B82F6', sublabel: `${guestCount} ${isEs ? 'invitados' : 'guests'}` },
        { label: isEs ? 'Espacios' : 'Spaces', value: (teams || []).filter((t: any) => t.status !== 'archived').length, icon: Database, color: '#8B5CF6' },
        { label: isEs ? 'Tareas totales' : 'Total Tasks', value: tasksSnap.data().count, icon: BarChart3, color: '#22C55E' },
        { label: isEs ? 'Documentos' : 'Documents', value: docsSnap.data().count, icon: FileText, color: '#EC4899' },
        { label: isEs ? 'Formularios' : 'Forms', value: formsSnap.data().count, icon: FileInput, color: '#F59E0B', sublabel: `${formSubsSnap.data().count} ${isEs ? 'respuestas' : 'submissions'}` },
        { label: isEs ? 'Automations activas' : 'Active Automations', value: activeAutoSnap.data().count, icon: Zap, color: '#06B6D4', sublabel: `${automationsSnap.data().count} ${isEs ? 'total' : 'total'} · ${autoLogsSnap.data().count} ${isEs ? 'ejecuciones' : 'runs'}` },
        { label: isEs ? 'Reportes programados' : 'Scheduled Reports', value: reportsSnap.data().count, icon: Mail, color: '#64748B' },
        { label: isEs ? 'API Keys' : 'API Keys', value: apiKeysSnap.data().count, icon: Key, color: '#F97316' },
        { label: 'Webhooks', value: webhooksSnap.data().count, icon: Webhook, color: '#A855F7' },
      ]);
    } catch (err) {
      console.error('[UsageDashboard] Failed to load:', err);
      setMetrics([]);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
          <BarChart3 className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {lang === 'es' ? 'Uso de la plataforma' : 'Platform Usage'}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {lang === 'es' ? 'Metricas de consumo y recursos activos' : 'Resource consumption and active usage metrics'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={i}
              className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-4 flex items-start gap-3"
            >
              <div
                className="p-2.5 rounded-xl shrink-0"
                style={{ backgroundColor: `${m.color}15`, border: `1px solid ${m.color}30` }}
              >
                <Icon className="h-5 w-5" style={{ color: m.color }} />
              </div>
              <div>
                <p className="text-[12px] text-[var(--text-muted)] font-medium">{m.label}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{m.value}</p>
                {m.sublabel && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{m.sublabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
