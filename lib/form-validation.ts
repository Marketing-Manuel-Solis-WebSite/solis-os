import type { FormField } from '@/components/forms/constants';

// ================================================================
// Shared validation logic — used both client-side and server-side
// ================================================================

interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Strip HTML/script tags and dangerous protocols for XSS prevention */
export function sanitizeValue(value: any): any {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?\w[^>]*>/g, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    // Block dangerous protocols including unicode-escaped variants
    .replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .trim();
}

/** Evaluate a conditional-visibility rule */
export function evaluateCondition(
  condition: FormField['conditionalOn'],
  allValues: Record<string, any>,
): boolean {
  if (!condition) return true; // no condition → always visible
  const fieldValue = allValues[condition.fieldId];
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
    case 'not_empty':
      return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0);
    default:
      return true;
  }
}

/** Validate all submission values against form fields */
export function validateSubmission(
  fields: FormField[],
  values: Record<string, any>,
  t: TFn,
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    // Skip hidden-by-condition fields
    if (!evaluateCondition(field.conditionalOn, values)) continue;

    const raw = values[field.id];
    const val = sanitizeValue(raw);

    // Required check
    if (field.required) {
      const empty =
        val === '' || val === null || val === undefined ||
        (Array.isArray(val) && val.length === 0) ||
        (field.type === 'checkbox' && val === false);
      if (empty) {
        errors[field.id] = t('formValidation.required', { label: field.label || field.type });
        continue;
      }
    }

    // Skip further validations if value is empty and not required
    if (val === '' || val === null || val === undefined) continue;

    const v = field.validations;

    switch (field.type) {
      case 'short_text':
      case 'long_text': {
        if (typeof val !== 'string') break;
        if (v.minLength && val.length < v.minLength) {
          errors[field.id] = t('formValidation.minLength', { n: v.minLength });
        } else if (v.maxLength && val.length > v.maxLength) {
          errors[field.id] = t('formValidation.maxLength', { n: v.maxLength });
        } else if (v.pattern) {
          try {
            if (!new RegExp(v.pattern).test(val)) {
              errors[field.id] = t('formValidation.pattern');
            }
          } catch { /* invalid regex — skip */ }
        }
        break;
      }

      case 'number': {
        const num = Number(val);
        if (isNaN(num)) {
          errors[field.id] = t('formValidation.invalidNumber');
        } else if (v.min !== undefined && num < v.min) {
          errors[field.id] = t('formValidation.min', { n: v.min });
        } else if (v.max !== undefined && num > v.max) {
          errors[field.id] = t('formValidation.max', { n: v.max });
        }
        break;
      }

      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof val === 'string' && !emailRegex.test(val)) {
          errors[field.id] = t('formValidation.invalidEmail');
        }
        break;
      }

      case 'phone': {
        const phoneRegex = /^[\d\s\-+().]{7,20}$/;
        if (typeof val === 'string' && !phoneRegex.test(val)) {
          errors[field.id] = t('formValidation.invalidPhone');
        }
        break;
      }

      case 'url': {
        try {
          if (typeof val === 'string') new URL(val);
        } catch {
          errors[field.id] = t('formValidation.invalidUrl');
        }
        break;
      }

      case 'rating': {
        const r = Number(val);
        if (isNaN(r) || r < 0 || r > (field.ratingMax || 5)) {
          errors[field.id] = t('formValidation.invalidRating');
        }
        break;
      }

      case 'file': {
        // File validation is handled at upload time, but check count
        if (Array.isArray(val) && v.maxFiles && val.length > v.maxFiles) {
          errors[field.id] = t('formValidation.maxFiles', { n: v.maxFiles });
        }
        break;
      }

      case 'multi_select': {
        if (!Array.isArray(val)) break;
        if (v.minLength && val.length < v.minLength) {
          errors[field.id] = t('formValidation.minSelect', { n: v.minLength });
        } else if (v.maxLength && val.length > v.maxLength) {
          errors[field.id] = t('formValidation.maxSelect', { n: v.maxLength });
        }
        break;
      }

      case 'date': {
        if (typeof val !== 'string' || !val) break;
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          errors[field.id] = t('formValidation.invalidDate', { label: field.label || 'Date' });
        }
        break;
      }

      case 'dropdown':
      case 'radio': {
        // Validate that the selected value is one of the defined options
        if (field.options?.length && val) {
          const validValues = field.options.map(o => o.value);
          if (!validValues.includes(val)) {
            errors[field.id] = t('formValidation.invalidSelection', { label: field.label || field.type });
          }
        }
        break;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
