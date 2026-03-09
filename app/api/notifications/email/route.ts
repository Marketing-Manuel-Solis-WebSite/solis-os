import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Solis Center <notifications@soliscenter.com>';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || '');
}

/** Escape HTML special characters to prevent XSS in email templates. */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the caller has at least manager role to send emails
    const memberSnap = await adminDb.collection('orgs/solis-center/members').doc(authedUser.uid).get();
    const callerRole = memberSnap.data()?.role as string | undefined;
    const ALLOWED_EMAIL_ROLES = ['owner', 'admin', 'manager'];
    if (!memberSnap.exists || !callerRole || !ALLOWED_EMAIL_ROLES.includes(callerRole)) {
      return NextResponse.json({ error: 'Insufficient permissions to send emails' }, { status: 403 });
    }

    const body = await request.json();
    const { to: explicitTo, userId, subject, title, message, actorName, type } = body;

    if (!title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Resolve recipient email: use explicit `to` or look up from userId
    let to = explicitTo;
    if (!to && userId) {
      // Validate userId format to prevent path traversal (Firebase UIDs are alphanumeric, 28 chars)
      if (typeof userId !== 'string' || !/^[a-zA-Z0-9]{1,128}$/.test(userId)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
      }
      const recipientSnap = await adminDb.doc(`orgs/solis-center/members/${userId}`).get();
      const recipientData = recipientSnap.data();
      if (!recipientData?.email) {
        return NextResponse.json({ error: 'Recipient email not found' }, { status: 400 });
      }
      // Check if user has email notifications enabled
      if (recipientData.preferences?.notifications?.email === false) {
        return NextResponse.json({ skipped: true, reason: 'Email notifications disabled' });
      }
      to = recipientData.email;
    }

    if (!to) {
      return NextResponse.json({ error: 'Missing recipient (to or userId)' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const typeLabels: Record<string, string> = {
      task_assigned: 'Task Assignment',
      task_mentioned: 'Mention',
      task_completed: 'Task Completed',
      task_due_soon: 'Due Date Reminder',
      channel_mention: 'Chat Mention',
      doc_mentioned: 'Document Update',
      system: 'System Notification',
    };

    const typeLabel = typeLabels[type] || 'Notification';

    // Escape all user-controlled values before interpolation into HTML
    const safeTitle = escapeHtml(title);
    const safeMessage = escapeHtml(message);
    const safeActorName = escapeHtml(actorName);
    const safeSubject = escapeHtml(subject);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0C1017;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;background:#3B82F6;border-radius:14px;line-height:48px;font-size:20px;font-weight:bold;color:#FFFFFF;">⚡</div>
      <h1 style="color:#3B82F6;font-size:22px;margin:12px 0 4px;letter-spacing:2px;">SOLIS CENTER</h1>
      <p style="color:#64748B;font-size:12px;margin:0;letter-spacing:3px;">LAW OFFICE OF MANUEL SOLIS</p>
    </div>
    <div style="background:#111827;border:1px solid #1F293780;border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="display:inline-block;padding:4px 12px;background:#3B82F618;border:1px solid #3B82F630;border-radius:20px;font-size:11px;color:#3B82F6;font-weight:600;margin-bottom:16px;">${typeLabel.toUpperCase()}</div>
      <h2 style="color:#F1F5F9;font-size:18px;margin:0 0 8px;font-weight:600;">${safeTitle}</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 16px;">${safeMessage}</p>
      ${safeActorName ? `<p style="color:#64748B;font-size:12px;margin:0;">From: <span style="color:#3B82F6;font-weight:500;">${safeActorName}</span></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://soliscenter.com'}/app" style="display:inline-block;padding:12px 32px;background:#3B82F6;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open Solis Center</a>
    </div>
    <p style="text-align:center;color:#475569;font-size:11px;margin-top:32px;">You're receiving this because you have email notifications enabled in Solis Center.</p>
  </div>
</body>
</html>`;

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: safeSubject || `${typeLabel}: ${safeTitle}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error('Email error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
