import { Type, AlignLeft, Hash, Mail, Phone, Calendar, ChevronDown, List, CheckSquare, Circle, Paperclip, Link, Star, EyeOff } from 'lucide-react';

export interface FormDocument {
  id: string;
  orgId: string;
  title: string;
  description: string;
  status: FormStatus;
  publicToken: string;
  responseLimit: number | null;
  responseCount: number;
  openAt: any;
  closeAt: any;
  logoUrl: string;
  layout: '1col' | '2col';
  successMessage: string;
  redirectUrl: string;
  fields: FormField[];
  captchaEnabled: boolean;
  rateLimitPerMinute: number;
  collectIp: boolean;
  collectUserAgent: boolean;
  privacyNotice: string;
  consentRequired: boolean;
  retentionDays: number | null;
  defaultMappingId: string;
  autoConvert: boolean;
  createdBy: string;
  createdByName: string;
  teamId: string;
  folderId?: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  defaultValue: any;
  validations: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    fileTypes?: string[];
    maxFileSize?: number;
    maxFiles?: number;
  };
  options: { label: string; value: string }[];
  ratingMax?: number;
  ratingIcon?: 'star' | 'heart' | 'number';
  conditionalOn?: {
    fieldId: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_empty';
    value: any;
  } | null;
  order: number;
}

export interface FormSubmission {
  id: string;
  values: Record<string, any>;
  ip: string | null;
  userAgent: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrer: string;
  attachments: { fieldId: string; url: string; name: string; type: string; size: number }[];
  status: SubmissionStatus;
  reviewedBy: string;
  reviewedAt: any;
  notes: string;
  assignedTo: string;
  convertedToType: string | null;
  convertedToId: string | null;
  convertedAt: any;
  convertedBy: string | null;
  consentGiven: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface FormMapping {
  id: string;
  name: string;
  entityType: string;
  targetTeamId: string;
  defaultStatus: string;
  defaultPriority: string;
  defaultAssignees: string[];
  defaultTags: string[];
  fieldMap: Record<string, string>;
  autoSubtasks: { title: string; done: boolean }[];
  autoChecklist: { text: string; checked: boolean }[];
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export type FieldType =
  | 'short_text' | 'long_text' | 'number' | 'email' | 'phone'
  | 'date' | 'dropdown' | 'multi_select' | 'checkbox' | 'radio'
  | 'file' | 'url' | 'rating' | 'hidden';

export type FormStatus = 'draft' | 'published' | 'paused' | 'archived';
export type SubmissionStatus = 'new' | 'reviewed' | 'converted' | 'discarded';

export const FIELD_TYPES: { value: FieldType; labelKey: string; icon: any }[] = [
  { value: 'short_text', labelKey: 'field.shortText', icon: Type },
  { value: 'long_text', labelKey: 'field.longText', icon: AlignLeft },
  { value: 'number', labelKey: 'field.number', icon: Hash },
  { value: 'email', labelKey: 'field.email', icon: Mail },
  { value: 'phone', labelKey: 'field.phone', icon: Phone },
  { value: 'date', labelKey: 'field.date', icon: Calendar },
  { value: 'dropdown', labelKey: 'field.dropdown', icon: ChevronDown },
  { value: 'multi_select', labelKey: 'field.multiSelect', icon: List },
  { value: 'checkbox', labelKey: 'field.checkbox', icon: CheckSquare },
  { value: 'radio', labelKey: 'field.radio', icon: Circle },
  { value: 'file', labelKey: 'field.file', icon: Paperclip },
  { value: 'url', labelKey: 'field.url', icon: Link },
  { value: 'rating', labelKey: 'field.rating', icon: Star },
  { value: 'hidden', labelKey: 'field.hidden', icon: EyeOff },
];

export const FORM_STATUSES: { value: FormStatus; labelKey: string; color: string }[] = [
  { value: 'draft', labelKey: 'forms.statusDraft', color: '#6B7280' },
  { value: 'published', labelKey: 'forms.statusPublished', color: '#22C55E' },
  { value: 'paused', labelKey: 'forms.statusPaused', color: '#F59E0B' },
  { value: 'archived', labelKey: 'forms.statusArchived', color: '#9CA3AF' },
];

export const SUBMISSION_STATUSES: { value: SubmissionStatus; labelKey: string; color: string }[] = [
  { value: 'new', labelKey: 'submissions.new', color: '#3B82F6' },
  { value: 'reviewed', labelKey: 'submissions.reviewed', color: '#8B5CF6' },
  { value: 'converted', labelKey: 'submissions.converted', color: '#22C55E' },
  { value: 'discarded', labelKey: 'submissions.discarded', color: '#6B7280' },
];

export function createEmptyField(type: FieldType, order: number): FormField {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type,
    label: '',
    description: '',
    placeholder: '',
    required: false,
    defaultValue: type === 'checkbox' ? false : type === 'rating' ? 0 : '',
    validations: {},
    options: type === 'dropdown' || type === 'multi_select' || type === 'radio'
      ? [{ label: '', value: 'opt1' }]
      : [],
    ratingMax: type === 'rating' ? 5 : undefined,
    ratingIcon: type === 'rating' ? 'star' : undefined,
    conditionalOn: null,
    order,
  };
}
