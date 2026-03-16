'use client';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';
import { loadSpaceStatuses } from '@/lib/status-config';
import type { StatusConfig } from '@/lib/status-config';
import { loadFieldDefs, getFieldsForContext } from '@/lib/custom-fields';
import type { CustomFieldDef } from '@/lib/custom-fields';
import { getAutomations } from '@/lib/db';
import type { InheritanceConfig } from '@/types';

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_INHERITANCE: InheritanceConfig = {
  statusMode: 'inherit',
  customFieldMode: 'inherit',
  automationMode: 'inherit',
};

// ============================================
// PERSISTENCE — load/save inheritance config per space
// ============================================

function inheritancePath(spaceId: string): string {
  return `orgs/${ORG}/teams/${spaceId}/settings/inheritance`;
}

/** Load inheritance config for a space. Falls back to defaults. */
export async function getInheritanceConfig(spaceId: string): Promise<InheritanceConfig> {
  try {
    const snap = await getDoc(doc(db, inheritancePath(spaceId)));
    if (snap.exists()) {
      const data = snap.data();
      return { ...DEFAULT_INHERITANCE, ...data };
    }
  } catch (err) {
    console.error('[Inheritance] Failed to load config:', err);
  }
  return { ...DEFAULT_INHERITANCE };
}

/** Save inheritance config for a space (merge). */
export async function setInheritanceConfig(
  spaceId: string,
  config: Partial<InheritanceConfig>,
): Promise<void> {
  await setDoc(doc(db, inheritancePath(spaceId)), {
    ...config,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ============================================
// RESOLVE STATUSES — Space → List hierarchy
// ============================================

/**
 * Resolve the effective statuses for a given context.
 *
 * - No listId → returns the space-level statuses.
 * - With listId → checks if the list document stores a local status
 *   override (list.statusOverride === 'override' + non-empty statuses array).
 *   If so, returns those; otherwise inherits the space statuses.
 */
export async function resolveStatuses(
  spaceId: string,
  listId?: string,
): Promise<StatusConfig> {
  const spaceConfig = await loadSpaceStatuses(spaceId);

  if (!listId) return spaceConfig;

  try {
    const listSnap = await getDoc(doc(db, `lists/${listId}`));
    if (listSnap.exists()) {
      const data = listSnap.data();
      if (
        data.statusOverride === 'override' &&
        Array.isArray(data.statuses) &&
        data.statuses.length > 0
      ) {
        return {
          statuses: data.statuses,
          version: data.statusVersion || 1,
        };
      }
    }
  } catch (err) {
    console.error('[Inheritance] Failed to load list status override:', err);
  }

  return spaceConfig;
}

// ============================================
// RESOLVE CUSTOM FIELDS — Org → Space → List
// ============================================

/**
 * Resolve the effective custom fields for a given context.
 *
 * Modes (from the space's InheritanceConfig.customFieldMode):
 *   'inherit'  — org + space-scoped fields only (list fields excluded)
 *   'extend'   — org + space + list-scoped fields merged together
 *   'override' — only list-scoped fields (when a listId is provided)
 *
 * When no listId is provided, always returns org-wide + space-scoped fields.
 */
export async function resolveCustomFields(
  spaceId: string,
  listId?: string,
): Promise<CustomFieldDef[]> {
  const settings = await loadFieldDefs();
  const allFields = settings.fields;

  if (!listId) {
    // No list context → return org-wide + space-scoped fields
    return getFieldsForContext(allFields, { spaceId });
  }

  const config = await getInheritanceConfig(spaceId);

  switch (config.customFieldMode) {
    case 'override': {
      // Only list-scoped fields
      return getFieldsForContext(allFields, { listId });
    }
    case 'extend': {
      // Org + space + list fields merged (deduplicated by id)
      const spaceFields = getFieldsForContext(allFields, { spaceId });
      const listFields = getFieldsForContext(allFields, { listId });
      const seen = new Set(spaceFields.map(f => f.id));
      const extra = listFields.filter(f => !seen.has(f.id));
      return [...spaceFields, ...extra];
    }
    case 'inherit':
    default: {
      // Org + space fields only (ignore list-scoped)
      return getFieldsForContext(allFields, { spaceId });
    }
  }
}

// ============================================
// RESOLVE AUTOMATIONS — Space → List
// ============================================

/**
 * Resolve the effective automations for a given context.
 *
 * Modes (from the space's InheritanceConfig.automationMode):
 *   'inherit'  — space-level automations only
 *   'extend'   — space + list-level automations merged
 *   'override' — only list-level automations (when a listId is provided)
 *
 * Automations are matched by their `teamId` (space) and `listId` fields.
 * The _folderId parameter is reserved for future folder-level support.
 */
export async function resolveAutomations(
  spaceId: string,
  _folderId?: string,
  listId?: string,
): Promise<any[]> {
  const { items: allAutomations } = await getAutomations(spaceId);
  const spaceAutomations = allAutomations.filter(
    (a: any) => a.teamId === spaceId && !a.listId,
  );

  if (!listId) return spaceAutomations;

  const config = await getInheritanceConfig(spaceId);
  const listAutomations = allAutomations.filter(
    (a: any) => a.listId === listId,
  );

  switch (config.automationMode) {
    case 'override':
      return listAutomations;
    case 'extend':
      return [...spaceAutomations, ...listAutomations];
    case 'inherit':
    default:
      return spaceAutomations;
  }
}
