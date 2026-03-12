'use client';
import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WIDGET_CATALOG, ADMIN_ONLY_TYPES } from '@/lib/dashboard-types';
import type { WidgetLayout } from '@/lib/dashboard-types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Hash, PieChart, CheckSquare, Activity, Target, TrendingUp, Calendar, Flag, BarChart3, Inbox, Sparkles, PackageOpen } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Hash, PieChart, CheckSquare, Activity, Target, TrendingUp, Calendar, Flag, BarChart3, Inbox, Sparkles,
};

interface WidgetPickerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: string) => void;
  existingWidgets: WidgetLayout[];
  isAdmin?: boolean;
}

export default function WidgetPicker({ open, onClose, onAdd, existingWidgets, isAdmin }: WidgetPickerProps) {
  const { t } = useI18n();

  // SECURITY: Filter out admin-only widgets for non-admin users + already-added widgets
  const available = useMemo(() => {
    const existingTypes = new Set(existingWidgets.map(w => w.type));
    return WIDGET_CATALOG.filter(wt => {
      // Admin-only widget gating
      if (!isAdmin && ADMIN_ONLY_TYPES.has(wt.type)) return false;
      if (wt.type === 'stat-card') return true;
      return !existingTypes.has(wt.type);
    });
  }, [existingWidgets, isAdmin]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="bg-[var(--bg-elevated)] rounded-2xl shadow-xl border border-[var(--border)] w-full max-w-md max-h-[75vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {t('dashboard.builder.addWidget')}
                </h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                  {available.length} disponible{available.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-px bg-[var(--border-subtle)]" />

            {/* Widget list */}
            <div className="p-3 overflow-y-auto max-h-[58vh] scrollbar-thin">
              {available.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <PackageOpen className="h-10 w-10 text-[var(--text-muted)] opacity-40" />
                  <p className="text-[13px] text-[var(--text-muted)] text-center">
                    Ya tienes todos los widgets agregados
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {available.map((wt, i) => {
                    const Icon = ICON_MAP[wt.icon] || Hash;
                    return (
                      <motion.button
                        key={`${wt.type}-${i}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { onAdd(wt.type); }}
                        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors hover:bg-[var(--bg-hover)] group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center shrink-0 group-hover:bg-[var(--accent)]/15 transition-colors">
                          <Icon className="h-4 w-4 text-[var(--accent)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[var(--text-primary)]">
                            {t(wt.nameKey)}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                            {t(wt.descriptionKey)}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
