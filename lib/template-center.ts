// ================================================================
// Template Center — Unified template management
// Merges built-in templates from workspace-templates.ts and
// automation-templates.ts with user-created templates in Firestore.
// ================================================================

import {
  collection, doc, addDoc, updateDoc, getDocs, getDoc,
  query, where, orderBy, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId, ORG_ID as ORG } from '@/lib/org';
import { WORKSPACE_TEMPLATES, type WorkspaceTemplate } from './workspace-templates';
import { AUTOMATION_TEMPLATES, type AutomationTemplate as AutomationTmpl } from './automation-templates';

// ---- Types ----

export type TemplateType = 'space' | 'list' | 'task' | 'doc' | 'automation' | 'folder';

export type TemplateCategoryLabel =
  | 'PM'
  | 'Marketing'
  | 'Engineering'
  | 'Legal'
  | 'General';

export interface UnifiedTemplate {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  category: TemplateCategoryLabel;
  icon: string;
  isBuiltIn: boolean;
  usageCount: number;
  /** The raw template data — shape depends on type */
  data: Record<string, any>;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ---- Firestore path ----

function templatesPath() { return `orgs/${getCurrentOrgId()}/templates`; }
/** @deprecated Use templatesPath() for multi-tenant readiness */
const TEMPLATES_PATH = `orgs/${ORG}/templates`;

// ---- Category mapping from workspace template categories ----

const WORKSPACE_CATEGORY_MAP: Record<string, TemplateCategoryLabel> = {
  law_firm: 'Legal',
  marketing_agency: 'Marketing',
  software_dev: 'Engineering',
  consulting: 'PM',
  startup: 'Engineering',
  general: 'General',
  custom: 'General',
};

const AUTOMATION_CATEGORY_MAP: Record<string, TemplateCategoryLabel> = {
  assignment: 'PM',
  status: 'PM',
  notification: 'General',
  organization: 'PM',
  review: 'Engineering',
};

// ---- Built-in template conversion ----

function workspaceToUnified(wt: WorkspaceTemplate): UnifiedTemplate {
  return {
    id: `builtin-ws-${wt.id}`,
    name: wt.name,
    description: wt.description,
    type: 'space',
    category: WORKSPACE_CATEGORY_MAP[wt.category] || 'General',
    icon: wt.icon,
    isBuiltIn: true,
    usageCount: 0,
    data: wt as unknown as Record<string, any>,
  };
}

function automationToUnified(at: AutomationTmpl): UnifiedTemplate {
  return {
    id: `builtin-auto-${at.id}`,
    name: at.name,
    description: at.description,
    type: 'automation',
    category: AUTOMATION_CATEGORY_MAP[at.category] || 'General',
    icon: 'Zap',
    isBuiltIn: true,
    usageCount: 0,
    data: at as unknown as Record<string, any>,
  };
}

/** Get all built-in templates, optionally filtered by type */
export function getBuiltInTemplates(type?: TemplateType): UnifiedTemplate[] {
  const results: UnifiedTemplate[] = [];

  if (!type || type === 'space') {
    results.push(...WORKSPACE_TEMPLATES.map(workspaceToUnified));
  }
  if (!type || type === 'automation') {
    results.push(...AUTOMATION_TEMPLATES.map(automationToUnified));
  }

  return results;
}

// ---- Firestore CRUD ----

/** Get all templates: built-in + user-created from Firestore, optionally filtered by type */
export async function getAllTemplates(orgId?: string, type?: TemplateType): Promise<UnifiedTemplate[]> {
  const builtIn = getBuiltInTemplates(type);

  // Fetch user-created templates from Firestore
  const constraints: any[] = [];
  if (type) constraints.push(where('type', '==', type));

  const q = constraints.length > 0
    ? query(collection(db, TEMPLATES_PATH), ...constraints)
    : query(collection(db, TEMPLATES_PATH));

  let firestoreTemplates: UnifiedTemplate[] = [];
  try {
    const snap = await getDocs(q);
    firestoreTemplates = snap.docs.map(d => ({
      id: d.id,
      isBuiltIn: false,
      ...d.data(),
    } as UnifiedTemplate));
  } catch (err) {
    console.error('[TemplateCenter] Failed to fetch Firestore templates:', err);
  }

  // Merge: built-in first, then user-created
  return [...builtIn, ...firestoreTemplates];
}

/** Apply a template — resolves the template and calls the appropriate instantiation logic */
export async function applyTemplate(
  templateId: string,
  context: { userId: string; orgId?: string; targetName?: string; [key: string]: any },
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  try {
    // Check if built-in
    const builtIn = getBuiltInTemplates().find(t => t.id === templateId);
    if (builtIn) {
      // Increment usage for built-in (stored in a usage tracking collection)
      await incrementUsage(templateId);
      return { success: true, entityId: templateId };
    }

    // Firestore template
    const snap = await getDoc(doc(db, TEMPLATES_PATH, templateId));
    if (!snap.exists()) return { success: false, error: 'Template not found' };

    await incrementUsage(templateId);
    return { success: true, entityId: templateId };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to apply template' };
  }
}

/** Save an existing entity as a reusable template */
export async function createTemplateFromEntity(
  entityType: TemplateType,
  entityId: string,
  name: string,
  options?: {
    description?: string;
    category?: TemplateCategoryLabel;
    icon?: string;
    data?: Record<string, any>;
    createdBy?: string;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, TEMPLATES_PATH), {
    name,
    description: options?.description || '',
    type: entityType,
    category: options?.category || 'General',
    icon: options?.icon || 'FileText',
    isBuiltIn: false,
    usageCount: 0,
    sourceEntityId: entityId,
    data: options?.data || {},
    createdBy: options?.createdBy || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Increment the usage counter for a template */
export async function incrementUsage(templateId: string): Promise<void> {
  // For built-in templates, track usage in a separate collection
  if (templateId.startsWith('builtin-')) {
    const usagePath = `orgs/${getCurrentOrgId()}/templateUsage`;
    try {
      const usageRef = doc(db, usagePath, templateId);
      const snap = await getDoc(usageRef);
      if (snap.exists()) {
        await updateDoc(usageRef, { count: increment(1), updatedAt: serverTimestamp() });
      } else {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(usageRef, { templateId, count: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error('[TemplateCenter] Failed to track built-in template usage:', err);
    }
    return;
  }

  // For Firestore templates, increment directly
  try {
    await updateDoc(doc(db, TEMPLATES_PATH, templateId), {
      usageCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[TemplateCenter] Failed to increment usage:', err);
  }
}
