import { NextRequest, NextResponse } from 'next/server';
import { getFormByToken, createFormSubmission, updateForm, createTask } from '@/lib/db-admin';
import { validateSubmission, sanitizeValue } from '@/lib/form-validation';
import { notifyManyAdmin } from '@/lib/db-admin';
import { queueEvent } from '@/lib/integrations-db-admin';
import { adminDb } from '@/lib/firebase-admin';
import type { FormDocument } from '@/components/forms/constants';

// ---- In-memory rate limiter ----
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 300000);

// Simple translation fallback for server-side validation
function serverT(key: string, params?: Record<string, string | number>): string {
  const messages: Record<string, string> = {
    'formValidation.required': '{label} is required',
    'formValidation.minLength': 'Minimum {n} characters',
    'formValidation.maxLength': 'Maximum {n} characters',
    'formValidation.min': 'Minimum value is {n}',
    'formValidation.max': 'Maximum value is {n}',
    'formValidation.pattern': 'Invalid format',
    'formValidation.invalidNumber': 'Enter a valid number',
    'formValidation.invalidEmail': 'Enter a valid email',
    'formValidation.invalidPhone': 'Enter a valid phone number',
    'formValidation.invalidUrl': 'Enter a valid URL',
    'formValidation.invalidRating': 'Invalid rating',
    'formValidation.maxFiles': 'Maximum {n} files',
    'formValidation.minSelect': 'Select at least {n}',
    'formValidation.maxSelect': 'Select at most {n}',
  };
  let msg = messages[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(`{${k}}`, String(v));
    }
  }
  return msg;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formId, token, values, attachments, consentGiven, utmSource, utmMedium, utmCampaign, referrer, _hp, _ts } = body;

    // Anti-bot: reject if honeypot field is filled
    if (_hp) return NextResponse.json({ ok: true }); // Silent success to not reveal detection
    // Anti-bot: reject if submitted faster than 2 seconds after page load
    if (_ts && Date.now() - Number(_ts) < 2000) return NextResponse.json({ ok: true });

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    // Load form by token (server-side via admin SDK)
    const formData = await getFormByToken(token);
    if (!formData) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    const form = formData as FormDocument;

    // Check status
    if (form.status !== 'published') {
      return NextResponse.json({ error: 'Form is not accepting responses' }, { status: 403 });
    }

    // Check response limit
    if (form.responseLimit && form.responseCount >= form.responseLimit) {
      return NextResponse.json({ error: 'Response limit reached' }, { status: 403 });
    }

    // Check date window
    const now = new Date();
    if (form.openAt) {
      const openDate = form.openAt?.toDate ? form.openAt.toDate() : new Date(form.openAt?.seconds ? form.openAt.seconds * 1000 : form.openAt);
      if (now < openDate) return NextResponse.json({ error: 'Form not yet open' }, { status: 403 });
    }
    if (form.closeAt) {
      const closeDate = form.closeAt?.toDate ? form.closeAt.toDate() : new Date(form.closeAt?.seconds ? form.closeAt.seconds * 1000 : form.closeAt);
      if (now > closeDate) return NextResponse.json({ error: 'Form has closed' }, { status: 403 });
    }

    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `${form.id}:${ip}`;
    if (!checkRateLimit(rateLimitKey, form.rateLimitPerMinute || 10)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Consent check
    if (form.consentRequired && !consentGiven) {
      return NextResponse.json({ error: 'Consent is required' }, { status: 400 });
    }

    // Server-side validation
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(values || {})) {
      sanitized[key] = sanitizeValue(val);
    }

    const { valid, errors } = validateSubmission(form.fields, sanitized, serverT);
    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Create submission (server-side via admin SDK — no client SDK needed)
    const userAgent = req.headers.get('user-agent') || '';
    await createFormSubmission(form.id, {
      values: sanitized,
      ip: form.collectIp ? ip : null,
      userAgent: form.collectUserAgent ? userAgent : null,
      utmSource: utmSource || '',
      utmMedium: utmMedium || '',
      utmCampaign: utmCampaign || '',
      referrer: referrer || '',
      attachments: attachments || [],
      status: 'new',
      reviewedBy: '',
      reviewedAt: null,
      notes: '',
      assignedTo: '',
      convertedToType: null,
      convertedToId: null,
      convertedAt: null,
      convertedBy: null,
      consentGiven: !!consentGiven,
    });

    // Auto-convert to task if enabled
    if ((form as any).autoConvert && (form as any).defaultMappingId) {
      try {
        const mappingSnap = await adminDb.doc(`forms/${form.id}/mappings/${(form as any).defaultMappingId}`).get();
        if (mappingSnap.exists) {
          const mapping = mappingSnap.data()!;
          const fieldMap = mapping.fieldMap || {};

          // Build task title and description from field map
          let taskTitle = `${form.title} — Submission`;
          let taskDescription = '';
          for (const [formFieldId, taskField] of Object.entries(fieldMap)) {
            const val = sanitized[formFieldId];
            if (!val) continue;
            if (taskField === 'title') taskTitle = String(val);
            else if (taskField === 'description') taskDescription = String(val);
          }

          const taskRef = await createTask({
            title: taskTitle,
            description: taskDescription || Object.entries(sanitized).map(([k, v]) => `**${k}:** ${v}`).join('\n'),
            status: mapping.defaultStatus || 'todo',
            priority: mapping.defaultPriority || 'medium',
            assignees: mapping.defaultAssignees || [],
            tags: [...(mapping.defaultTags || []), 'form-submission'],
            teamId: mapping.targetTeamId || '',
            createdBy: `form:${form.id}`,
            customFields: sanitized,
          });

          // Update submission with conversion metadata
          if (taskRef?.id) {
            await adminDb.doc(`forms/${form.id}/submissions/${taskRef.id}`).update({
              convertedToType: 'task',
              convertedToId: taskRef.id,
              convertedAt: new Date(),
              convertedBy: 'auto',
              status: 'converted',
            }).catch((err) => console.error('[FormSubmit] update submission conversion metadata failed:', err));
          }
        }
      } catch (err) {
        console.error('[FormSubmit] auto-convert to task failed:', err);
        // Don't block submission if auto-convert fails
      }
    }

    // Increment response count
    await updateForm(form.id, { responseCount: (form.responseCount || 0) + 1 });

    // Queue webhook event
    queueEvent({
      eventType: 'form.submitted',
      entityId: form.id,
      entityType: 'form',
      payload: { formTitle: form.title, responseCount: (form.responseCount || 0) + 1 },
    }).catch((err) => console.error('[FormSubmit] queue webhook event failed:', err));

    // Notify form creator
    if (form.createdBy) {
      try {
        await notifyManyAdmin([form.createdBy], {
          type: 'form_submission',
          title: `Nueva respuesta: ${form.title}`,
          message: `Se recibió una nueva respuesta en el formulario "${form.title}"`,
          entityUrl: '/app/forms',
        });
      } catch (err) { /* notification failure shouldn't block submission */ console.error('[FormSubmit] notification to creator failed:', err); }
    }

    // Check if limit is now reached
    if (form.responseLimit && (form.responseCount || 0) + 1 >= form.responseLimit) {
      await updateForm(form.id, { status: 'paused' });
      if (form.createdBy) {
        try {
          await notifyManyAdmin([form.createdBy], {
            type: 'form_limit_reached',
            title: `Formulario pausado: ${form.title}`,
            message: `El formulario alcanzó el límite de ${form.responseLimit} respuestas y fue pausado automáticamente.`,
            entityUrl: '/app/forms',
          });
        } catch (err) { /* ignore */ console.error('[FormSubmit] limit-reached notification failed:', err); }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[FormSubmit] submission failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
