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
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('formBuilder.fieldPalette')}</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {FIELD_TYPES.map(ft => {
          const Icon = ft.icon;
          return (
            <button
              key={ft.value}
              type="button"
              onClick={() => onAdd(ft.value)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150 border border-transparent hover:border-[var(--border-subtle)]"
            >
              <Icon className="h-4 w-4 text-[var(--text-muted)] shrink-0" strokeWidth={1.75} />
              <span className="truncate">{t(ft.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
