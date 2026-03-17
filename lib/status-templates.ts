'use client';

// ================================================================
// Status Templates — Centrally governed, versionable, subscribable
// ================================================================
// Unlike ClickUp where editing a template in a Space silently forks it,
// SOLIS OS templates stay synchronized: editing a template propagates
// to all subscribed Spaces. Spaces must explicitly override to decouple.
//
// Stored at: orgs/{orgId}/settings/statusTemplates/{templateId}

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';
import type { StatusDef } from './status-config';

// ---- Types ----

export interface StatusTemplate {
  id: string;
  orgId: string;
  name: string;
  description: string;
  statuses: StatusDef[];
  version: number;
  /** Space IDs that subscribe to this template */
  subscribedSpaces: string[];
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  updatedBy: string;
}

export interface TemplateBlastRadius {
  templateId: string;
  templateName: string;
  affectedSpaces: { id: string; name: string }[];
  affectedSpaceCount: number;
}

// ---- Firestore paths ----

function templatesCol() {
  return collection(db, 'orgs', ORG, 'settings', 'statusTemplates', 'templates');
}

function templateDoc(id: string) {
  return doc(db, 'orgs', ORG, 'settings', 'statusTemplates', 'templates', id);
}

// ---- CRUD ----

export async function getStatusTemplates(): Promise<StatusTemplate[]> {
  const q = query(templatesCol(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StatusTemplate));
}

export async function getStatusTemplate(id: string): Promise<StatusTemplate | null> {
  const snap = await getDoc(templateDoc(id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StatusTemplate;
}

export async function createStatusTemplate(data: {
  name: string;
  description: string;
  statuses: StatusDef[];
  createdBy: string;
}): Promise<string> {
  // Validate
  const hasStart = data.statuses.some(s => s.category === 'not_started');
  const hasDone = data.statuses.some(s => s.category === 'done');
  if (!hasStart || !hasDone) {
    throw new Error('Template must have at least one "not_started" and one "done" status.');
  }

  const ref = await addDoc(templatesCol(), {
    orgId: ORG,
    name: data.name,
    description: data.description,
    statuses: data.statuses,
    version: 1,
    subscribedSpaces: [],
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: data.createdBy,
  });
  return ref.id;
}

/**
 * Update a template AND propagate to all subscribed Spaces.
 * Returns the blast radius so the UI can show what was affected.
 */
export async function updateStatusTemplate(
  templateId: string,
  data: { name?: string; description?: string; statuses?: StatusDef[] },
  userId: string,
): Promise<TemplateBlastRadius> {
  const template = await getStatusTemplate(templateId);
  if (!template) throw new Error('Template not found');

  // Validate if statuses changed
  if (data.statuses) {
    const hasStart = data.statuses.some(s => s.category === 'not_started');
    const hasDone = data.statuses.some(s => s.category === 'done');
    if (!hasStart || !hasDone) {
      throw new Error('Template must have at least one "not_started" and one "done" status.');
    }
  }

  const newVersion = template.version + 1;

  // Update the template itself
  await updateDoc(templateDoc(templateId), {
    ...data,
    version: newVersion,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Propagate to subscribed spaces
  const affectedSpaces: { id: string; name: string }[] = [];
  if (data.statuses && template.subscribedSpaces.length > 0) {
    const batch = writeBatch(db);
    for (const spaceId of template.subscribedSpaces) {
      const spaceStatusPath = `orgs/${ORG}/teams/${spaceId}/settings/statuses`;
      batch.set(doc(db, spaceStatusPath), {
        statuses: data.statuses,
        version: newVersion,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
        templateId,
        templateVersion: newVersion,
      });
      affectedSpaces.push({ id: spaceId, name: spaceId }); // Name resolved by caller
    }
    await batch.commit();
  }

  return {
    templateId,
    templateName: data.name || template.name,
    affectedSpaces,
    affectedSpaceCount: affectedSpaces.length,
  };
}

export async function deleteStatusTemplate(templateId: string): Promise<void> {
  await deleteDoc(templateDoc(templateId));
}

// ---- Subscription management ----

/**
 * Subscribe a Space to a template. Sets the Space's statuses to the template's
 * and records the subscription.
 */
export async function subscribeSpaceToTemplate(
  spaceId: string,
  templateId: string,
  userId: string,
): Promise<void> {
  const template = await getStatusTemplate(templateId);
  if (!template) throw new Error('Template not found');

  // Update space statuses
  const spaceStatusPath = `orgs/${ORG}/teams/${spaceId}/settings/statuses`;
  const batch = writeBatch(db);

  batch.set(doc(db, spaceStatusPath), {
    statuses: template.statuses,
    version: template.version,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
    templateId,
    templateVersion: template.version,
  });

  // Add space to template's subscription list
  const subs = template.subscribedSpaces.includes(spaceId)
    ? template.subscribedSpaces
    : [...template.subscribedSpaces, spaceId];

  batch.update(templateDoc(templateId), {
    subscribedSpaces: subs,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Unsubscribe a Space from a template. The Space keeps its current statuses
 * but is no longer updated when the template changes.
 */
export async function unsubscribeSpaceFromTemplate(
  spaceId: string,
  templateId: string,
): Promise<void> {
  const template = await getStatusTemplate(templateId);
  if (!template) return;

  await updateDoc(templateDoc(templateId), {
    subscribedSpaces: template.subscribedSpaces.filter(id => id !== spaceId),
    updatedAt: serverTimestamp(),
  });
}

// ---- Blast radius preview ----

/**
 * Preview what would be affected by updating a template, WITHOUT applying.
 */
export async function previewBlastRadius(
  templateId: string,
): Promise<TemplateBlastRadius> {
  const template = await getStatusTemplate(templateId);
  if (!template) throw new Error('Template not found');

  return {
    templateId,
    templateName: template.name,
    affectedSpaces: template.subscribedSpaces.map(id => ({ id, name: id })),
    affectedSpaceCount: template.subscribedSpaces.length,
  };
}
