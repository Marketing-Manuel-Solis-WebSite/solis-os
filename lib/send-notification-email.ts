// ============================================================
// Server-Side Email Sending (Resend)
// ============================================================
//
// Shared email function used by notify-admin.ts (server dispatchers)
// and the /api/notifications/email route (client-triggered).
//
// This module is SERVER-ONLY (uses Resend SDK + env vars).
// ============================================================

import { Resend } from 'resend';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://soliscenter.com';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TYPE_LABELS: Record<string, string> = {
  task_assigned: 'Task Assignment',
  task_mentioned: 'Mention',
  task_completed: 'Task Completed',
  task_due_soon: 'Due Date Reminder',
  task_overdue: 'Task Overdue',
  task_comment: 'New Comment',
  channel_mention: 'Chat Mention',
  channel_message: 'New Message',
  goal_assigned: 'Goal Assignment',
  goal_completed: 'Goal Completed',
  goal_overdue: 'Goal At Risk',
  form_submission: 'New Submission',
  form_limit_reached: 'Form Paused',
  webhook_delivery_failed: 'Webhook Failed',
  system: 'System Notification',
};

// TODO: use recipient language preference to select label map
const TYPE_LABELS_ES: Record<string, string> = {
  task_assigned: 'Asignación de tarea',
  task_mentioned: 'Mención',
  task_completed: 'Tarea completada',
  task_comment: 'Comentario en tarea',
  task_due_soon: 'Tarea próxima a vencer',
  task_overdue: 'Tarea vencida',
  goal_assigned: 'Meta asignada',
  goal_completed: 'Meta completada',
  goal_overdue: 'Meta vencida',
  channel_message: 'Mensaje de canal',
  channel_mention: 'Mención en canal',
  doc_mentioned: 'Mención en documento',
  form_submission: 'Envío de formulario',
  form_limit_reached: 'Límite de respuestas alcanzado',
  webhook_delivery_failed: 'Error en webhook',
  system: 'Notificación del sistema',
};

export interface SendEmailParams {
  to: string;
  type: string;
  title: string;
  message: string;
  actorName?: string;
  entityUrl?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendNotificationEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[sendNotificationEmail] RESEND_API_KEY not configured');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  // --- Privacy transformations (applied to email only, not stored notification) ---
  // Strip email addresses from actorName
  const sanitizedActorName = (params.actorName || '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[usuario]');
  // Truncate title to 50 chars for subject line
  const truncatedTitle = params.title.length > 50
    ? params.title.slice(0, 50) + '...'
    : params.title;
  // Truncate message/body to 200 chars
  const truncatedMessage = params.message.length > 200
    ? params.message.slice(0, 200) + '...'
    : params.message;

  const typeLabel = TYPE_LABELS[params.type] || 'Notification';
  const subject = `${typeLabel}: ${truncatedTitle}`;

  const safeTitle = escapeHtml(truncatedTitle);
  const safeMessage = escapeHtml(truncatedMessage);
  const safeActorName = escapeHtml(sanitizedActorName);

  const ctaUrl = params.entityUrl
    ? `${APP_URL}${params.entityUrl.startsWith('/') ? params.entityUrl : '/' + params.entityUrl}`
    : `${APP_URL}/app`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0C1017;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;background:#3B82F6;border-radius:14px;line-height:48px;font-size:20px;font-weight:bold;color:#FFFFFF;">&#9889;</div>
      <h1 style="color:#3B82F6;font-size:22px;margin:12px 0 4px;letter-spacing:2px;">SOLIS CENTER</h1>
      <p style="color:#64748B;font-size:12px;margin:0;letter-spacing:3px;">LAW OFFICE OF MANUEL SOLIS</p>
    </div>
    <div style="background:#111827;border:1px solid #1F293780;border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="display:inline-block;padding:4px 12px;background:#3B82F618;border:1px solid #3B82F630;border-radius:20px;font-size:11px;color:#3B82F6;font-weight:600;margin-bottom:16px;">${escapeHtml(typeLabel).toUpperCase()}</div>
      <h2 style="color:#F1F5F9;font-size:18px;margin:0 0 8px;font-weight:600;">${safeTitle}</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 16px;">${safeMessage}</p>
      ${safeActorName ? `<p style="color:#64748B;font-size:12px;margin:0;">From: <span style="color:#3B82F6;font-weight:500;">${safeActorName}</span></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 32px;background:#3B82F6;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Abrir Solis Center</a>
    </div>
    <p style="text-align:center;color:#475569;font-size:11px;margin-top:32px;">Recibes este correo porque tienes las notificaciones por email habilitadas en Solis Center.</p>
  </div>
</body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Solis Center <notifications@soliscenter.com>';
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [params.to],
      subject,
      html,
    });
    if (error) {
      console.error('[sendNotificationEmail] Resend API error:', error);
      return { success: false, error: String(error.message || error) };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[sendNotificationEmail] Error:', err?.message || err);
    return { success: false, error: err?.message || 'Unknown email error' };
  }
}
