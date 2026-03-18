import 'server-only';

import { adminDb, ORG, addTo, updateAt, getOne } from './helpers';

// ===== FORMS =====
export async function getForm(id: string) { return getOne(`forms/${id}`); }

export async function getFormByToken(token: string) {
  const snap = await adminDb.collection('forms')
    .where('publicToken', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function updateForm(formId: string, data: any) { return updateAt(`forms/${formId}`, data); }

export async function createFormSubmission(formId: string, data: any) {
  return addTo(`forms/${formId}/submissions`, {
    values: data.values || {},
    ip: data.ip || null,
    userAgent: data.userAgent || null,
    utmSource: data.utmSource || '',
    utmMedium: data.utmMedium || '',
    utmCampaign: data.utmCampaign || '',
    referrer: data.referrer || '',
    attachments: data.attachments || [],
    status: 'new',
    reviewedBy: '',
    reviewedAt: null,
    notes: '',
    assignedTo: '',
    convertedToType: null,
    convertedToId: null,
    convertedAt: null,
    convertedBy: null,
    consentGiven: data.consentGiven ?? false,
  });
}

export async function getFormSubmissions(formId: string, maxResults = 500) {
  const snap = await adminDb.collection(`forms/${formId}/submissions`)
    .orderBy('createdAt', 'desc')
    .limit(maxResults + 1)
    .get();
  const hasMore = snap.docs.length > maxResults;
  const docs = hasMore ? snap.docs.slice(0, maxResults) : snap.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}

/** Accurate document count for an org-scoped collection (uses Firestore count aggregation). */
export async function countByOrg(col: string): Promise<number> {
  const snap = await adminDb.collection(col)
    .where('orgId', '==', ORG)
    .count()
    .get();
  return snap.data().count;
}

/** Accurate document count for a subcollection. */
export async function countSubcollection(parentPath: string, subcollectionName: string): Promise<number> {
  const snap = await adminDb.collection(`${parentPath}/${subcollectionName}`)
    .count()
    .get();
  return snap.data().count;
}
