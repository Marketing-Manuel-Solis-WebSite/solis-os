'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { FileInput, Loader2, ExternalLink } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';

interface Props {
  artifactId: string;
  scopeType?: string;
  scopeId?: string;
}

export default function FormViewPanel({ artifactId }: Props) {
  const { lang } = useI18n();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artifactId) return;
    const ref = doc(db, 'orgs', getCurrentOrgId(), 'forms', artifactId);
    getDoc(ref).then(snap => {
      if (snap.exists()) setForm({ id: snap.id, ...snap.data() });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [artifactId]);

  if (!artifactId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
        <FileInput className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">{lang === 'es' ? 'Selecciona un formulario' : 'Select a form'}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
        <FileInput className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">{lang === 'es' ? 'Formulario no encontrado' : 'Form not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{form.title}</h3>
          {form.description && <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{form.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
            form.status === 'published' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
            form.status === 'draft' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' :
            'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'
          }`}>
            {form.status}
          </span>
          {form.publicToken && (
            <a href={`/forms/${form.publicToken}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline">
              <ExternalLink className="h-3 w-3" />
              {lang === 'es' ? 'Ver formulario' : 'View form'}
            </a>
          )}
        </div>
      </div>

      {/* Fields preview */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">{lang === 'es' ? 'Campos' : 'Fields'} ({(form.fields || []).length})</h4>
        {(form.fields || []).map((field: any, i: number) => (
          <div key={field.id || i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-elevated)]">
            <span className="text-[12px] font-medium text-[var(--text-primary)]">{field.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{field.type}</span>
            {field.required && <span className="text-[10px] text-[var(--error)]">*</span>}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-2 border-t border-[var(--border-subtle)]">
        <span className="text-[12px] text-[var(--text-muted)]">
          {lang === 'es' ? 'Respuestas' : 'Responses'}: <strong className="text-[var(--text-primary)]">{form.responseCount || 0}</strong>
        </span>
      </div>
    </div>
  );
}
