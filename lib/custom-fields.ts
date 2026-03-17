import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID } from '@/lib/org';

const SETTINGS_PATH = `orgs/${ORG_ID}/settings/customFields`;

// Extended field types
export type CustomFieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'percentage'
  | 'boolean' | 'date' | 'datetime'
  | 'email' | 'phone' | 'url'
  | 'single_select' | 'multi_select'
  | 'user' | 'rating'
  | 'formula' | 'rollup' | 'relationship' | 'button';

export type FieldScope = 'org' | 'space' | 'list';

export interface CustomFieldDef {
  id: string;
  name: string;
  nameEs: string;
  type: CustomFieldType;
  group: string;
  required: boolean;
  defaultValue?: unknown;
  helpText?: string;
  helpTextEs?: string;
  options?: { id: string; label: string; color: string }[];
  validation?: { min?: number; max?: number; regex?: string; minLength?: number; maxLength?: number };
  order: number;
  archived: boolean;
  isLegacy: boolean;
  createdAt?: any;
  createdBy?: string;
  /** Scope level — 'org' (default) applies everywhere, 'space' or 'list' restricts visibility */
  scope?: FieldScope;
  /** ID of the space or list this field is scoped to. Null = org-wide. */
  scopeId?: string | null;
  /** Formula config — only for type 'formula' */
  formulaConfig?: { expression: string; resultType: 'number' | 'text' | 'boolean' | 'date' };
  /** Rollup config — only for type 'rollup' */
  rollupConfig?: { sourceRelation: 'subtasks' | 'child_tasks' | 'related_tasks'; sourceField: string; aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percent_done'; resultType: 'number' | 'percentage' };
  /** Relationship config — only for type 'relationship' */
  relationshipConfig?: { targetTypes: ('task' | 'doc' | 'goal')[]; relationType: string; allowMultiple: boolean };
}

export interface CustomFieldGroupDef {
  id: string;
  name: string;
  nameEs: string;
  order: number;
}

export interface CustomFieldSettings {
  fields: CustomFieldDef[];
  groups: CustomFieldGroupDef[];
  version: number;
  updatedAt?: any;
  updatedBy?: string;
}

// Legacy hardcoded fields → CustomFieldDef migration
const LEGACY_FIELDS: CustomFieldDef[] = [
  { id: 'caseNumber', name: 'Case Number', nameEs: 'No. de Caso', type: 'text', group: 'legal', required: false, order: 0, archived: false, isLegacy: true, scope: 'org' },
  { id: 'caseValue', name: 'Case Value', nameEs: 'Valor del Caso', type: 'currency', group: 'legal', required: false, order: 1, archived: false, isLegacy: true, scope: 'org' },
  { id: 'filingDate', name: 'Filing Date', nameEs: 'Fecha de Presentación', type: 'date', group: 'legal', required: false, order: 2, archived: false, isLegacy: true, scope: 'org' },
  { id: 'caseType', name: 'Case Type', nameEs: 'Tipo de Caso', type: 'single_select', group: 'legal', required: false, order: 3, archived: false, isLegacy: true, scope: 'org',
    options: [
      { id: 'civil', label: 'Civil', color: '#3B82F6' },
      { id: 'criminal', label: 'Criminal', color: '#EF4444' },
      { id: 'familia', label: 'Familia', color: '#EC4899' },
      { id: 'inmigracion', label: 'Inmigración', color: '#F59E0B' },
      { id: 'laboral', label: 'Laboral', color: '#10B981' },
      { id: 'otro', label: 'Otro', color: '#6B7280' },
    ],
  },
  { id: 'courtLocation', name: 'Court Location', nameEs: 'Ubicación del Juzgado', type: 'text', group: 'legal', required: false, order: 4, archived: false, isLegacy: true, scope: 'org' },
  { id: 'retainerPaid', name: 'Retainer Paid', nameEs: 'Anticipo Pagado', type: 'boolean', group: 'legal', required: false, order: 5, archived: false, isLegacy: true, scope: 'org' },
  { id: 'clientName', name: 'Client Name', nameEs: 'Nombre del Cliente', type: 'text', group: 'client', required: false, order: 6, archived: false, isLegacy: true, scope: 'org' },
  { id: 'clientPhone', name: 'Client Phone', nameEs: 'Teléfono del Cliente', type: 'phone', group: 'client', required: false, order: 7, archived: false, isLegacy: true, scope: 'org' },
  { id: 'clientEmail', name: 'Client Email', nameEs: 'Email del Cliente', type: 'email', group: 'client', required: false, order: 8, archived: false, isLegacy: true, scope: 'org' },
  { id: 'referenceUrl', name: 'Reference URL', nameEs: 'URL de Referencia', type: 'url', group: 'reference', required: false, order: 9, archived: false, isLegacy: true, scope: 'org' },
];

const LEGACY_GROUPS: CustomFieldGroupDef[] = [
  { id: 'legal', name: 'Legal / Case', nameEs: 'Legal / Caso', order: 0 },
  { id: 'client', name: 'Client', nameEs: 'Cliente', order: 1 },
  { id: 'reference', name: 'Reference', nameEs: 'Referencia', order: 2 },
];

// Load field definitions (with lazy migration)
export async function loadFieldDefs(): Promise<CustomFieldSettings> {
  try {
    const snap = await getDoc(doc(db, SETTINGS_PATH));
    if (snap.exists()) {
      const data = snap.data();
      if (data.version && data.fields) {
        return {
          fields: data.fields as CustomFieldDef[],
          groups: data.groups as CustomFieldGroupDef[],
          version: data.version,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
      }
    }
  } catch (err) {
    console.error('[CustomFields] Failed to load settings, falling back to migration:', err);
  }

  // Lazy migrate from hardcoded defaults
  const settings: CustomFieldSettings = {
    fields: LEGACY_FIELDS,
    groups: LEGACY_GROUPS,
    version: 1,
  };

  try {
    await setDoc(doc(db, SETTINGS_PATH), {
      ...settings,
      updatedAt: serverTimestamp(),
      updatedBy: 'system-migration',
    });
  } catch (err) {
    console.error('[CustomFields] Migration write failed (non-fatal):', err);
  }

  return settings;
}

// Save field definitions
export async function saveFieldDefs(
  fields: CustomFieldDef[],
  groups: CustomFieldGroupDef[],
  userId: string,
  currentVersion: number,
): Promise<void> {
  await setDoc(doc(db, SETTINGS_PATH), {
    fields,
    groups,
    version: currentVersion + 1,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

// Type compatibility groups — types within a group can be changed safely
const TYPE_COMPAT_GROUPS: Record<string, CustomFieldType[]> = {
  text: ['text', 'textarea', 'email', 'phone', 'url'],
  numeric: ['number', 'currency', 'percentage'],
  select: ['single_select', 'multi_select'],
  temporal: ['date', 'datetime'],
};

function areTypesCompatible(oldType: CustomFieldType, newType: CustomFieldType): boolean {
  if (oldType === newType) return true;
  for (const group of Object.values(TYPE_COMPAT_GROUPS)) {
    if (group.includes(oldType) && group.includes(newType)) return true;
  }
  return false;
}

// Save a single field (add or update)
// Throws if type change is incompatible (would corrupt existing data)
export async function saveFieldDef(
  field: CustomFieldDef,
  allFields: CustomFieldDef[],
  groups: CustomFieldGroupDef[],
  userId: string,
  currentVersion: number,
): Promise<void> {
  const idx = allFields.findIndex(f => f.id === field.id);
  const newFields = [...allFields];
  if (idx >= 0) {
    const existing = allFields[idx];
    // Block incompatible type changes
    if (existing.type !== field.type && !areTypesCompatible(existing.type, field.type)) {
      throw new Error(
        `Cannot change field type from "${existing.type}" to "${field.type}". ` +
        `This would corrupt existing task data. Archive this field and create a new one instead.`
      );
    }
    newFields[idx] = field;
  } else {
    newFields.push(field);
  }
  await saveFieldDefs(newFields, groups, userId, currentVersion);
}

// Archive a field
export async function archiveFieldDef(
  fieldId: string,
  allFields: CustomFieldDef[],
  groups: CustomFieldGroupDef[],
  userId: string,
  currentVersion: number,
): Promise<void> {
  const newFields = allFields.map(f =>
    f.id === fieldId ? { ...f, archived: true } : f
  );
  await saveFieldDefs(newFields, groups, userId, currentVersion);
}

// Get active (non-archived) fields
export function getActiveFields(fields: CustomFieldDef[]): CustomFieldDef[] {
  return fields.filter(f => !f.archived).sort((a, b) => a.order - b.order);
}

/**
 * Get fields visible for a given context (space and/or list).
 * Returns org-wide fields + fields scoped to the given space/list.
 */
export function getFieldsForContext(
  fields: CustomFieldDef[],
  context: { spaceId?: string; listId?: string },
): CustomFieldDef[] {
  return getActiveFields(fields).filter(f => {
    // Org-wide fields are always visible
    if (!f.scope || f.scope === 'org') return true;
    // Space-scoped: visible if context matches
    if (f.scope === 'space' && f.scopeId && context.spaceId) {
      return f.scopeId === context.spaceId;
    }
    // List-scoped: visible if context matches
    if (f.scope === 'list' && f.scopeId && context.listId) {
      return f.scopeId === context.listId;
    }
    return false;
  });
}

// Get fields by group
export function getFieldsByGroup(fields: CustomFieldDef[]): Record<string, CustomFieldDef[]> {
  const result: Record<string, CustomFieldDef[]> = {};
  for (const f of getActiveFields(fields)) {
    if (!result[f.group]) result[f.group] = [];
    result[f.group].push(f);
  }
  return result;
}

// Generate a unique field ID
export function generateFieldId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30)
    + '_' + Date.now().toString(36);
}

// Validate custom field values against their definitions
// Returns an object of { fieldId: errorMessage } for invalid fields, or empty object if all valid
export function validateCustomFieldValues(
  values: Record<string, unknown>,
  fieldDefs: CustomFieldDef[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const activeFields = getActiveFields(fieldDefs);
  const defMap = new Map(activeFields.map(f => [f.id, f]));

  // Check required fields
  for (const def of activeFields) {
    if (def.required) {
      const val = values[def.id];
      if (val === undefined || val === null || val === '') {
        errors[def.id] = `${def.name} is required`;
      }
    }
  }

  // Type-check provided values
  for (const [fieldId, rawVal] of Object.entries(values)) {
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;
    const def = defMap.get(fieldId);
    if (!def) continue; // unknown field — ignore (could be archived)

    const val = rawVal;

    switch (def.type) {
      case 'number':
      case 'currency':
      case 'percentage': {
        const num = Number(val);
        if (isNaN(num)) { errors[fieldId] = `${def.name} must be a number`; break; }
        if (def.validation?.min !== undefined && num < def.validation.min) errors[fieldId] = `${def.name} minimum is ${def.validation.min}`;
        if (def.validation?.max !== undefined && num > def.validation.max) errors[fieldId] = `${def.name} maximum is ${def.validation.max}`;
        break;
      }
      case 'text':
      case 'textarea': {
        const str = String(val);
        if (def.validation?.minLength && str.length < def.validation.minLength) errors[fieldId] = `${def.name} minimum ${def.validation.minLength} characters`;
        if (def.validation?.maxLength && str.length > def.validation.maxLength) errors[fieldId] = `${def.name} maximum ${def.validation.maxLength} characters`;
        break;
      }
      case 'email': {
        const emailStr = String(val);
        if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailStr)) errors[fieldId] = `${def.name} is not a valid email`;
        break;
      }
      case 'url': {
        const urlStr = String(val);
        if (urlStr) { try { new URL(urlStr); } catch { errors[fieldId] = `${def.name} is not a valid URL`; } }
        break;
      }
      case 'rating': {
        const r = Number(val);
        if (isNaN(r) || r < 0 || r > 5) errors[fieldId] = `${def.name} must be between 0 and 5`;
        break;
      }
      case 'single_select': {
        if (def.options && def.options.length > 0) {
          const validIds = new Set(def.options.map(o => o.id));
          if (!validIds.has(String(val))) errors[fieldId] = `${def.name} has an invalid selection`;
        }
        break;
      }
      case 'multi_select': {
        if (Array.isArray(val) && def.options && def.options.length > 0) {
          const validIds = new Set(def.options.map(o => o.id));
          for (const v of val) {
            if (!validIds.has(String(v))) { errors[fieldId] = `${def.name} contains invalid selection`; break; }
          }
        }
        break;
      }
      case 'boolean': {
        if (typeof val !== 'boolean' && val !== 'true' && val !== 'false') errors[fieldId] = `${def.name} must be true or false`;
        break;
      }
      // date, datetime, phone, user — accept any non-empty value (validated at UI level)
    }
  }

  return errors;
}

// All available field types with labels
export const FIELD_TYPE_OPTIONS: { type: CustomFieldType; labelEs: string; labelEn: string }[] = [
  { type: 'text', labelEs: 'Texto', labelEn: 'Text' },
  { type: 'textarea', labelEs: 'Texto largo', labelEn: 'Long text' },
  { type: 'number', labelEs: 'Número', labelEn: 'Number' },
  { type: 'currency', labelEs: 'Moneda', labelEn: 'Currency' },
  { type: 'percentage', labelEs: 'Porcentaje', labelEn: 'Percentage' },
  { type: 'boolean', labelEs: 'Sí/No', labelEn: 'Yes/No' },
  { type: 'date', labelEs: 'Fecha', labelEn: 'Date' },
  { type: 'datetime', labelEs: 'Fecha y hora', labelEn: 'Date & time' },
  { type: 'email', labelEs: 'Correo', labelEn: 'Email' },
  { type: 'phone', labelEs: 'Teléfono', labelEn: 'Phone' },
  { type: 'url', labelEs: 'URL', labelEn: 'URL' },
  { type: 'single_select', labelEs: 'Selección única', labelEn: 'Single select' },
  { type: 'multi_select', labelEs: 'Selección múltiple', labelEn: 'Multi select' },
  { type: 'user', labelEs: 'Usuario', labelEn: 'User' },
  { type: 'rating', labelEs: 'Calificación', labelEn: 'Rating' },
];
