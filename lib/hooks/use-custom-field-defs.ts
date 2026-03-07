'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadFieldDefs, type CustomFieldDef, type CustomFieldGroupDef, type CustomFieldSettings,
  getActiveFields,
} from '@/lib/custom-fields';
import { DEFAULT_CUSTOM_FIELDS, CUSTOM_FIELD_GROUPS } from '@/components/tasks/constants';

interface UseCustomFieldDefsReturn {
  fields: CustomFieldDef[];
  groups: CustomFieldGroupDef[];
  activeFields: CustomFieldDef[];
  version: number;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

// Map legacy DEFAULT_CUSTOM_FIELDS to CustomFieldDef as fallback
function legacyFallback(): { fields: CustomFieldDef[]; groups: CustomFieldGroupDef[] } {
  const fields: CustomFieldDef[] = DEFAULT_CUSTOM_FIELDS.map((f, i) => ({
    id: f.id,
    name: f.label,
    nameEs: f.label,
    type: mapLegacyType(f.type),
    group: f.group,
    required: false,
    options: f.options?.map((o, j) => ({ id: o.toLowerCase().replace(/\s+/g, '_'), label: o, color: '#6B7280' })),
    order: i,
    archived: false,
    isLegacy: true,
  }));

  const groups: CustomFieldGroupDef[] = CUSTOM_FIELD_GROUPS.map((g, i) => ({
    id: g.id,
    name: g.id.charAt(0).toUpperCase() + g.id.slice(1),
    nameEs: g.id.charAt(0).toUpperCase() + g.id.slice(1),
    order: i,
  }));

  return { fields, groups };
}

function mapLegacyType(type: string): CustomFieldDef['type'] {
  switch (type) {
    case 'text': return 'text';
    case 'currency': return 'currency';
    case 'date': return 'date';
    case 'select': return 'single_select';
    case 'checkbox': return 'boolean';
    case 'phone': return 'phone';
    case 'email': return 'email';
    case 'url': return 'url';
    default: return 'text';
  }
}

export function useCustomFieldDefs(): UseCustomFieldDefsReturn {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [groups, setGroups] = useState<CustomFieldGroupDef[]>([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const settings = await loadFieldDefs();
      setFields(settings.fields);
      setGroups(settings.groups);
      setVersion(settings.version);
      setError(false);
    } catch {
      // Fallback to legacy hardcoded fields
      const fb = legacyFallback();
      setFields(fb.fields);
      setGroups(fb.groups);
      setVersion(0);
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      refresh();
    }
  }, [refresh]);

  const activeFields = getActiveFields(fields);

  return { fields, groups, activeFields, version, loading, error, refresh };
}
