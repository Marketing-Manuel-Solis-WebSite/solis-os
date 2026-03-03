'use client';
import { FIELD_TYPES, type FieldType } from './constants';
import { useI18n } from '@/lib/i18n';

interface Props {
  onAdd: (type: FieldType) => void;
}

export default function FormFieldPalette({ onAdd }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <h3 className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{t('formBuilder.fieldPalette')}</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {FIELD_TYPES.map(ft => {
          const Icon = ft.icon;
          return (
            <button
              key={ft.value}
              type="button"
              onClick={() => onAdd(ft.value)}
              className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150 border border-transparent hover:border-[var(--border-subtle)] hover:shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                <Icon className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.75} />
              </div>
              <span className="truncate w-full font-medium">{t(ft.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
