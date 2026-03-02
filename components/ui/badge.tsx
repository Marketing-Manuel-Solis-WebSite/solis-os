import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--bg-tertiary)] text-[var(--text-primary)]',
        secondary:
          'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        destructive:
          'bg-[var(--error-bg)] text-[var(--error)]',
        outline:
          'border border-[var(--border-strong)] text-[var(--text-primary)]',
        success:
          'bg-[var(--success-bg)] text-[var(--success)]',
        warning:
          'bg-[var(--warning-bg)] text-[var(--warning)]',
        info:
          'bg-[var(--info-bg)] text-[var(--info)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
