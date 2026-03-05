'use client';
import { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface WidgetShellProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
  compact?: boolean;
}

function WidgetShellInner({ title, icon, children, loading, className = '', headerRight, noPadding, compact }: WidgetShellProps) {
  return (
    <div
      className={`rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden flex flex-col h-full transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] ${className}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between shrink-0 ${compact ? 'px-4 py-3' : 'px-5 py-3.5'}`}>
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2 min-w-0">
          {icon && <span className="text-[var(--accent)] shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </h3>
        {headerRight && <div className="flex items-center gap-2 shrink-0 ml-2">{headerRight}</div>}
      </div>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent mx-4" />

      {/* Body */}
      <div className={`flex-1 min-h-0 overflow-hidden ${noPadding ? '' : compact ? 'px-4 pb-3 pt-3' : 'px-5 pb-4 pt-3'}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)] opacity-60" />
          </div>
        ) : children}
      </div>
    </div>
  );
}

export const WidgetShell = memo(WidgetShellInner);
