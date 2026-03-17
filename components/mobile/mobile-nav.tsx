'use client';

// ============================================================
// Mobile Bottom Navigation — 5-tab bar with role filtering,
// haptic-style tap feedback, and bottom-sheet "More" menu
// ============================================================

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, MessageSquare, FileText, Layers,
  Target, CalendarDays, BarChart3, Zap, Users, Clock, PenTool,
  FileInput, Plug, Shield, Bot, LayoutTemplate,
} from 'lucide-react';
import BottomSheet from '@/components/mobile/bottom-sheet';

interface NavItem {
  id: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  labelEn: string;
  labelEs: string;
  adminOnly?: boolean;
}

// Primary tabs — always visible in the bottom bar
const PRIMARY_TABS: NavItem[] = [
  { id: 'dashboard', href: '/app', Icon: LayoutDashboard, labelKey: 'nav.dashboard', labelEn: 'Home', labelEs: 'Inicio' },
  { id: 'tasks', href: '/app/tasks', Icon: CheckSquare, labelKey: 'nav.tasks', labelEn: 'Tasks', labelEs: 'Tareas' },
  { id: 'chat', href: '/app/chat', Icon: MessageSquare, labelKey: 'nav.chat', labelEn: 'Chat', labelEs: 'Chat' },
  { id: 'docs', href: '/app/docs', Icon: FileText, labelKey: 'nav.docs', labelEn: 'Docs', labelEs: 'Docs' },
];

// More menu items — shown in the bottom sheet
const MORE_ITEMS: NavItem[] = [
  { id: 'spaces', href: '/app/spaces', Icon: Layers, labelKey: 'nav.spaces', labelEn: 'Spaces', labelEs: 'Espacios' },
  { id: 'goals', href: '/app/goals', Icon: Target, labelKey: 'nav.goals', labelEn: 'Goals', labelEs: 'Metas' },
  { id: 'planner', href: '/app/planner', Icon: CalendarDays, labelKey: 'nav.planner', labelEn: 'Planner', labelEs: 'Planificador' },
  { id: 'analytics', href: '/app/analytics', Icon: BarChart3, labelKey: 'nav.analytics', labelEn: 'Analytics', labelEs: 'Analítica' },
  { id: 'automations', href: '/app/automations', Icon: Zap, labelKey: 'nav.automations', labelEn: 'Automations', labelEs: 'Automaciones' },
  { id: 'timesheets', href: '/app/timesheets', Icon: Clock, labelKey: 'nav.timesheets', labelEn: 'Timesheets', labelEs: 'Hojas de tiempo' },
  { id: 'ai', href: '/app/ai', Icon: Bot, labelKey: 'nav.ai', labelEn: 'Solis AI', labelEs: 'Solis AI' },
  { id: 'forms', href: '/app/forms', Icon: FileInput, labelKey: 'nav.forms', labelEn: 'Forms', labelEs: 'Formularios' },
  { id: 'templates', href: '/app/templates', Icon: LayoutTemplate, labelKey: 'nav.templates', labelEn: 'Templates', labelEs: 'Plantillas' },
  { id: 'whiteboards', href: '/app/whiteboards', Icon: PenTool, labelKey: 'nav.whiteboards', labelEn: 'Whiteboards', labelEs: 'Pizarras' },
  { id: 'integrations', href: '/app/integrations', Icon: Plug, labelKey: 'nav.integrations', labelEn: 'Integrations', labelEs: 'Integraciones' },
  { id: 'org-chart', href: '/app/org-chart', Icon: Users, labelKey: 'nav.orgChart', labelEn: 'Org Chart', labelEs: 'Organigrama' },
  { id: 'admin', href: '/app/admin', Icon: Shield, labelKey: 'nav.admin', labelEn: 'Admin', labelEs: 'Admin', adminOnly: true },
];

// Tap animation — subtle scale for haptic feel
const tapVariants = {
  tap: { scale: 0.88, transition: { duration: 0.1 } },
};

export default function MobileNav() {
  const { lang } = useI18n();
  const { isAdmin } = useAuth();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = useCallback((href: string) => {
    if (href === '/app') return pathname === '/app';
    return pathname?.startsWith(href) ?? false;
  }, [pathname]);

  // Check if any "more" item is active (to highlight the More tab)
  const moreActive = MORE_ITEMS.some(item => isActive(item.href));

  // Filter admin-only items for non-admins
  const visibleMoreItems = MORE_ITEMS.filter(item => !item.adminOnly || isAdmin);

  const label = (item: NavItem) => lang === 'es' ? item.labelEs : item.labelEn;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-base)] border-t border-[var(--border)] px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-center justify-around h-14">
          {PRIMARY_TABS.map(item => {
            const active = isActive(item.href);
            return (
              <motion.div key={item.id} whileTap="tap" variants={tapVariants}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-colors ${
                    active
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  <item.Icon className={`h-5 w-5 ${active ? 'text-[var(--accent)]' : ''}`} />
                  <span className="text-[10px] font-medium leading-none">
                    {label(item)}
                  </span>
                </Link>
              </motion.div>
            );
          })}

          {/* More button — opens bottom sheet */}
          <motion.button
            whileTap="tap"
            variants={tapVariants}
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-colors ${
              moreActive
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <Layers className={`h-5 w-5 ${moreActive ? 'text-[var(--accent)]' : ''}`} />
            <span className="text-[10px] font-medium leading-none">
              {lang === 'es' ? 'Más' : 'More'}
            </span>
          </motion.button>
        </div>
      </nav>

      {/* More bottom sheet */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={lang === 'es' ? 'Más opciones' : 'More options'}
      >
        <div className="grid grid-cols-3 gap-3 pb-4">
          {visibleMoreItems.map(item => {
            const active = isActive(item.href);
            return (
              <motion.div key={item.id} whileTap="tap" variants={tapVariants}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-colors ${
                    active
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] active:bg-[var(--bg-hover)]'
                  }`}
                >
                  <item.Icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium text-center leading-tight">
                    {label(item)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
