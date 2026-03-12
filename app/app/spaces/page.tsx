'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { getTasks, getGoals, getDocuments } from '@/lib/db';
import { motion } from 'framer-motion';
import {
  Layers, Users, CheckSquare, Target, FileText, ArrowRight,
  Loader2, Lock,
} from 'lucide-react';

interface SpaceCounts {
  tasks: number;
  goals: number;
  docs: number;
  members: number;
}

export default function SpacesPage() {
  const { user, me, teams, allMembers, canSeeAllTeams } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const [countMap, setCountMap] = useState<Record<string, SpaceCounts>>({});
  const [loading, setLoading] = useState(true);

  // SECURITY: Only show spaces the user belongs to (or all for admin)
  const accessibleTeams = useMemo(() => {
    const active = teams.filter(team => team.status !== 'archived');
    if (canSeeAllTeams) return active;
    return active.filter(team =>
      me?.teamId === team.id || me?.teamIds?.includes(team.id)
    );
  }, [teams, canSeeAllTeams, me?.teamId, me?.teamIds]);

  // Load counts for each accessible space
  useEffect(() => {
    if (!user || accessibleTeams.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadCounts() {
      const map: Record<string, SpaceCounts> = {};
      // Batch all fetches in parallel
      await Promise.all(
        accessibleTeams.map(async (team) => {
          const [tasksRes, goalsRes, docsRes] = await Promise.all([
            getTasks(team.id).catch(() => ({ items: [] })),
            getGoals(team.id).catch(() => ({ items: [] })),
            getDocuments(team.id).catch(() => ({ items: [] })),
          ]);
          const memberCount = allMembers.filter(
            m => m.teamId === team.id || m.teamIds?.includes(team.id)
          ).length;
          map[team.id] = {
            tasks: tasksRes.items.length,
            goals: goalsRes.items.length,
            docs: docsRes.items.length,
            members: memberCount,
          };
        })
      );
      if (!cancelled) {
        setCountMap(map);
        setLoading(false);
      }
    }

    loadCounts();
    return () => { cancelled = true; };
  }, [user, accessibleTeams, allMembers]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="px-6 pt-5 pb-8 max-w-[1440px] mx-auto"
    >
      {/* Hero */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-secondary)] to-[var(--accent)]/[0.04] p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--accent)]/[0.02] rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Layers className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight">
                  {t('spaces.title')}
                </h1>
                <p className="text-[14px] text-[var(--text-muted)] leading-relaxed">
                  {t('spaces.subtitle')}
                </p>
              </div>
            </div>

            {/* Summary badges */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
                <Layers className="h-3 w-3" />
                {accessibleTeams.length} {lang === 'es' ? 'espacios' : 'spaces'}
              </span>
              {!canSeeAllTeams && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-semibold">
                  <Lock className="h-3 w-3" />
                  {lang === 'es' ? 'Acceso personal' : 'Personal access'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 animate-ping" />
            <div className="relative w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-[13px] text-[var(--text-muted)]">
            {lang === 'es' ? 'Cargando espacios...' : 'Loading workspaces...'}
          </p>
        </div>
      ) : accessibleTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-2">
            <Layers className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          </div>
          <p className="text-[14px] text-[var(--text-muted)] font-medium">{t('spaces.noSpaces')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {accessibleTeams.map((team, i) => {
            const counts = countMap[team.id] || { tasks: 0, goals: 0, docs: 0, members: 0 };
            return (
              <motion.button
                key={team.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => router.push(`/app/spaces/${team.id}`)}
                className="group relative text-left rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300"
              >
                {/* Color accent bar */}
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: team.color || 'var(--accent)' }}
                />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${team.color || 'var(--accent)'}15` }}
                    >
                      {team.icon || '📁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors duration-200">
                        {team.name}
                      </h3>
                      {team.description && (
                        <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">
                          {team.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <StatPill icon={<Users className="h-3 w-3" />} value={counts.members} color={team.color} />
                    <StatPill icon={<CheckSquare className="h-3 w-3" />} value={counts.tasks} color={team.color} />
                    <StatPill icon={<Target className="h-3 w-3" />} value={counts.goals} color={team.color} />
                    <StatPill icon={<FileText className="h-3 w-3" />} value={counts.docs} color={team.color} />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function StatPill({ icon, value, color }: { icon: React.ReactNode; value: number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2 rounded-lg bg-[var(--bg-tertiary)]/50">
      <span className="text-[var(--text-muted)]" style={color ? { color: `${color}99` } : undefined}>
        {icon}
      </span>
      <span className="text-[12px] font-bold text-[var(--text-primary)] tabular-nums">{value}</span>
    </div>
  );
}
