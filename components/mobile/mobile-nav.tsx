'use client';

// ============================================================
// Mobile Bottom Navigation — 5-tab bar for mobile viewports
// ============================================================

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { LayoutDashboard, CheckSquare, MessageSquare, FileText, Menu } from 'lucide-react';

interface NavItem {
  id: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  labelEn: string;
  labelEs: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', href: '/app', Icon: LayoutDashboard, labelEn: 'Home', labelEs: 'Inicio' },
  { id: 'tasks', href: '/app/tasks', Icon: CheckSquare, labelEn: 'Tasks', labelEs: 'Tareas' },
  { id: 'chat', href: '/app/chat', Icon: MessageSquare, labelEn: 'Chat', labelEs: 'Chat' },
  { id: 'docs', href: '/app/docs', Icon: FileText, labelEn: 'Docs', labelEs: 'Docs' },
  { id: 'more', href: '/app/spaces', Icon: Menu, labelEn: 'More', labelEs: 'Más' },
];

export default function MobileNav() {
  const { lang } = useI18n();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app';
    return pathname?.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-base)] border-t border-[var(--border)] px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition ${
                active
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)] active:text-[var(--text-secondary)]'
              }`}
            >
              <item.Icon className={`h-5 w-5 ${active ? 'text-[var(--accent)]' : ''}`} />
              <span className="text-[10px] font-medium leading-none">
                {lang === 'es' ? item.labelEs : item.labelEn}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
