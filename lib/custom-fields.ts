import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const ORG = 'solis-center';
const SETTINGS_PATH = `orgs/${ORG}/settings/customFields`;

// Extended field types
export type CustomFieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'percentage'
  | 'boolean' | 'date' | 'datetime'
  | 'email' | 'phone' | 'url'
  | 'single_select' | 'multi_select'
  | 'user' | 'rating';

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
  { id: 'caseNumber', name: 'Case Number', nameEs: 'No. de Caso', type: 'text', group: 'legal', required: false, order: 0, archived: false, isLegacy: true },
  { id: 'caseValue', name: 'Case Value', nameEs: 'Valor del Caso', type: 'currency', group: 'legal', required: false, order: 1, archived: false, isLegacy: true },
  { id: 'filingDate', name: 'Filing Date', nameEs: 'Fecha de Presentación', type: 'date', group: 'legal', required: false, order: 2, archived: false, isLegacy: true },
  { id: 'caseType', name: 'Case Type', nameEs: 'Tipo de Caso', type: 'single_select', group: 'legal', required: false, order: 3, archived: false, isLegacy: true,
    options: [
      { id: 'civil', label: 'Civil', color: '#3B82F6' },
      { id: 'criminal', label: 'Criminal', color: '#EF4444' },
      { id: 'familia', label: 'Familia', color: '#EC4899' },
      { id: 'inmigracion', label: 'Inmigración', color: '#F59E0B' },
      { id: 'laboral', label: 'Laboral', color: '#10B981' },
      { id: 'otro', label: 'Otro', color: '#6B7280' },
    ],
  },
  { id: 'courtLocation', name: 'Court Location', nameEs: 'Ubicación del Juzgado', type: 'text', group: 'legal', required: false, order: 4, archived: false, isLegacy: true },
  { id: 'retainerPaid', name: 'Retainer Paid', nameEs: 'Anticipo Pagado', type: 'boolean', group: 'legal', required: false, order: 5, archived: false, isLegacy: true },
  { id: 'clientName', name: 'Client Name', nameEs: 'Nombre del Cliente', type: 'text', group: 'client', required: false, order: 6, archived: false, isLegacy: true },
  { id: 'clientPhone', name: 'Client Phone', nameEs: 'Teléfono del Cliente', type: 'phone', group: 'client', required: false, order: 7, archived: false, isLegacy: true },
  { id: 'clientEmail', name: 'Client Email', nameEs: 'Email del Cliente', type: 'email', group: 'client', required: false, order: 8, archived: false, isLegacy: true },
  { id: 'referenceUrl', name: 'Reference URL', nameEs: 'URL de Referencia', type: 'url', group: 'reference', required: false, order: 9, archived: false, isLegacy: true },
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
  } catch {
    // Fall through to migration
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
  } catch {
    // Migration write failure is non-fatal
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

// Save a single field (add or update)
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
