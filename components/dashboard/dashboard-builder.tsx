'use client';
import { useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Plus, Check, RotateCcw } from 'lucide-react';
import WidgetPicker from './widget-picker';
import type { WidgetLayout, DashboardConfig } from '@/lib/dashboard-types';
import { WIDGET_CATALOG, DEFAULT_WIDGETS, ADMIN_DEFAULT_WIDGETS } from '@/lib/dashboard-types';
import { saveDashboard } from '@/lib/dashboard-db';

interface DashboardBuilderProps {
  dashboard: DashboardConfig;
  editing: boolean;
  isAdmin?: boolean;
  onEditingChange: (editing: boolean) => void;
  onUpdate: (widgets: WidgetLayout[]) => void;
}

export default function DashboardBuilder({ dashboard, editing, isAdmin, onEditingChange, onUpdate }: DashboardBuilderProps) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAddWidget = useCallback((type: string) => {
    const catalog = WIDGET_CATALOG.find(w => w.type === type);
    if (!catalog) return;

    const newWidget: WidgetLayout = {
      widgetId: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: type as any,
      x: 0,
      y: 0,
      w: catalog.defaultSize.w,
      h: catalog.defaultSize.h,
      config: type === 'stat-card' ? { metric: 'totalTasks' } : {},
    };

    const updated = [...dashboard.widgets, newWidget];
    onUpdate(updated);
    saveDashboard(dashboard.id, { widgets: updated }).catch((err) => console.error('[Dashboard] save widget add failed:', err));
  }, [dashboard, onUpdate]);

  const handleReset = useCallback(() => {
    const defaults = isAdmin ? ADMIN_DEFAULT_WIDGETS : DEFAULT_WIDGETS;
    onUpdate(defaults);
    saveDashboard(dashboard.id, { widgets: defaults }).catch((err) => console.error('[Dashboard] save widget reset failed:', err));
    onEditingChange(false);
  }, [dashboard.id, isAdmin, onUpdate, onEditingChange]);

  const handleSave = useCallback(() => {
    saveDashboard(dashboard.id, { widgets: dashboard.widgets }).catch((err) => console.error('[Dashboard] save widgets failed:', err));
    onEditingChange(false);
  }, [dashboard, onEditingChange]);

  return (
    <>
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex items-center gap-2"
            >
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('dashboard.builder.addWidget')}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                title={t('dashboard.builder.reset')}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition"
              >
                <Check className="h-3.5 w-3.5" />
                {t('common.save')}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="toggle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onEditingChange(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t('dashboard.builder.customize')}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAddWidget}
        existingWidgets={dashboard.widgets}
        isAdmin={isAdmin}
      />
    </>
  );
}
