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
  dataSource?: string;
  noPadding?: boolean;
  compact?: boolean;
}

function WidgetShellInner({ title, icon, children, loading, className = '', headerRight, dataSource, noPadding, compact }: WidgetShellProps) {
  return (
    <div
      className={`
        rounded-2xl overflow-hidden flex flex-col h-full
        bg-[var(--bg-elevated)] border border-[var(--border-subtle)]
        shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]
        hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]
        transition-shadow duration-300
        ${className}
      `}
    >
      {/* Header */}
      <div className={`flex items-center justify-between shrink-0 bg-[var(--bg-tertiary)]/30 ${compact ? 'px-4 py-3' : 'px-5 py-3.5'}`}>
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2 min-w-0">
          {icon && <span className="text-[var(--accent)] shrink-0 opacity-80">{icon}</span>}
          <span className="truncate">{title}</span>
        </h3>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {dataSource && <span className="text-[10px] text-[var(--text-muted)] font-normal">{dataSource}</span>}
          {headerRight}
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)]/60 to-transparent" />

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
