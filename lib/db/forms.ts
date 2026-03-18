// ===========================================================
// FORMS
// ===========================================================

import {
  addTo, updateAt, deleteAt, getOne, getByOrg, getByTeam,
  deleteSubcollectionDocs,
  db, ORG, serverTimestamp,
  collection, getDocs, query, where, orderBy, limit, onSnapshot,
} from './helpers';

export async function getForms(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('forms', teamId, maxResults);
  return getByOrg('forms', maxResults);
}

export async function getForm(id: string) { return getOne(`forms/${id}`); }

export async function getFormByToken(token: string) {
  const q = query(collection(db, 'forms'), where('publicToken', '==', token), limit(1));
  const s = await getDocs(q);
  if (s.empty) return null;
  return { id: s.docs[0].id, ...s.docs[0].data() };
}

export async function createForm(data: any) {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  return addTo('forms', {
    orgId: ORG,
    title: data.title || '',
    description: data.description || '',
    status: 'draft',
    publicToken: token,
    responseLimit: null,
    responseCount: 0,
    openAt: null,
    closeAt: null,
    logoUrl: '',
    layout: '1col',
    successMessage: data.successMessage || '',
    redirectUrl: '',
    fields: data.fields || [],
    captchaEnabled: false,
    rateLimitPerMinute: 5,
    collectIp: true,
    collectUserAgent: true,
    privacyNotice: '',
    consentRequired: false,
    retentionDays: null,
    defaultMappingId: '',
    autoConvert: false,
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    teamId: data.teamId || '',
    folderId: data.folderId || null,
  });
}

export async function updateForm(formId: string, data: any) { return updateAt(`forms/${formId}`, data); }
export async function deleteForm(formId: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`forms/${formId}`, 'submissions'),
    deleteSubcollectionDocs(`forms/${formId}`, 'mappings'),
  ]);
  return deleteAt(`forms/${formId}`);
}

export async function regenerateFormToken(formId: string): Promise<string> {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  await updateAt(`forms/${formId}`, { publicToken: token });
  return token;
}

// Form Submissions (subcollection)
export async function getFormSubmissions(formId: string, maxResults = 500) {
  const q = query(collection(db, `forms/${formId}/submissions`), orderBy('createdAt', 'desc'), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}

export async function getFormSubmission(formId: string, submissionId: string) {
  return getOne(`forms/${formId}/submissions/${submissionId}`);
}

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

export async function updateFormSubmission(formId: string, submissionId: string, data: any) {
  return updateAt(`forms/${formId}/submissions/${submissionId}`, data);
}

export function onFormSubmissionsSnapshot(formId: string, callback: (subs: any[], hasMore: boolean) => void, maxResults = 100) {
  const q = query(collection(db, `forms/${formId}/submissions`), orderBy('createdAt', 'desc'), limit(maxResults + 1));
  return onSnapshot(q, (snap) => {
    const hasMore = snap.docs.length > maxResults;
    const docs = hasMore ? snap.docs.slice(0, maxResults) : snap.docs;
    callback(docs.map(d => ({ id: d.id, ...d.data() })), hasMore);
  }, () => callback([], false));
}

// Form Mappings (subcollection)
export async function getFormMappings(formId: string) {
  const q = query(collection(db, `forms/${formId}/mappings`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createFormMapping(formId: string, data: any) {
  return addTo(`forms/${formId}/mappings`, {
    name: data.name || '',
    entityType: data.entityType || 'task',
    targetTeamId: data.targetTeamId || '',
    defaultStatus: data.defaultStatus || 'todo',
    defaultPriority: data.defaultPriority || 'medium',
    defaultAssignees: data.defaultAssignees || [],
    defaultTags: data.defaultTags || [],
    fieldMap: data.fieldMap || {},
    autoSubtasks: data.autoSubtasks || [],
    autoChecklist: data.autoChecklist || [],
    createdBy: data.createdBy || '',
  });
}

export async function updateFormMapping(formId: string, mappingId: string, data: any) {
  return updateAt(`forms/${formId}/mappings/${mappingId}`, data);
}

export async function deleteFormMapping(formId: string, mappingId: string) {
  return deleteAt(`forms/${formId}/mappings/${mappingId}`);
}
