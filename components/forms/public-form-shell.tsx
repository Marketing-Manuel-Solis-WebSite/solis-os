'use client';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

interface Props {
  logoUrl?: string;
  children: ReactNode;
}

export default function PublicFormShell({ logoUrl, children }: Props) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <main className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl">
          {logoUrl && (
            <div className="flex justify-center mb-6">
              <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
            </div>
          )}
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm overflow-hidden">
            {children}
          </div>
        </div>
      </main>
      <footer className="py-4 text-center">
        <span className="text-[12px] text-[var(--text-muted)]">{t('publicForm.poweredBy')}</span>
      </footer>
    </div>
  );
}
