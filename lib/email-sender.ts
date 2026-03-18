// ================================================================
// Email Sender — Scheduled report delivery via Resend
// ================================================================
// SERVER-ONLY module for sending scheduled reports as email with
// optional PDF attachment.

import { Resend } from 'resend';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'reports@soliscenter.com';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'SOLIS Center';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export interface ReportEmailOptions {
  to: string[];
  reportName: string;
  reportDate: string;
  format: 'csv' | 'pdf';
  /** Base64-encoded file content */
  fileContent: string;
  fileName: string;
}

/**
 * Send a scheduled report email with attachment.
 */
export async function sendScheduledReportEmail(options: ReportEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();

    const mimeType = options.format === 'pdf' ? 'application/pdf' : 'text/csv';

    await resend.emails.send({
      from: `${APP_NAME} Reports <${FROM_EMAIL}>`,
      to: options.to,
      subject: `${options.reportName} — ${options.reportDate}`,
      html: buildReportEmailHtml(options.reportName, options.reportDate, options.format),
      attachments: [
        {
          filename: options.fileName,
          content: options.fileContent,
          contentType: mimeType,
        },
      ],
    });

    return { success: true };
  } catch (err: any) {
    console.error('[EmailSender] Failed to send report email:', err?.message);
    return { success: false, error: err?.message || 'Email send failed' };
  }
}

/**
 * Send a simple notification email (no attachment).
 */
export async function sendReportNotificationEmail(
  to: string[],
  subject: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();

    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html: body,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Email send failed' };
  }
}

function buildReportEmailHtml(reportName: string, reportDate: string, format: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f14; color: #e0e0e8; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
        .card { background: #1a1a24; border-radius: 16px; padding: 32px; border: 1px solid #2a2a3a; }
        .title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 8px; }
        .subtitle { font-size: 14px; color: #8888a0; margin: 0 0 24px; }
        .badge { display: inline-block; padding: 4px 12px; background: #7B68EE20; color: #7B68EE; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .footer { text-align: center; padding-top: 24px; font-size: 12px; color: #666680; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1 class="title">${escapeHtml(reportName)}</h1>
          <p class="subtitle">Report generated on ${escapeHtml(reportDate)}</p>
          <p style="font-size: 14px; color: #c0c0d0;">
            Your scheduled report is attached as a <span class="badge">${format.toUpperCase()}</span> file.
          </p>
        </div>
        <div class="footer">
          Sent by ${APP_NAME} · Scheduled Reports
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
