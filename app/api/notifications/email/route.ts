import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Solis Center <notifications@soliscenter.com>';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, title, message, actorName, type } = body;

    if (!to || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0C1017;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#D4A843,#9A7B2F);border-radius:14px;line-height:48px;font-size:20px;font-weight:bold;color:#06080F;">⚡</div>
      <h1 style="color:#D4A843;font-size:22px;margin:12px 0 4px;letter-spacing:2px;">SOLIS CENTER</h1>
      <p style="color:#64748B;font-size:12px;margin:0;letter-spacing:3px;">LAW OFFICE OF MANUEL SOLIS</p>
    </div>
    <div style="background:#111827;border:1px solid #1F293780;border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="display:inline-block;padding:4px 12px;background:#D4A84318;border:1px solid #D4A84330;border-radius:20px;font-size:11px;color:#D4A843;font-weight:600;margin-bottom:16px;">${typeLabel.toUpperCase()}</div>
      <h2 style="color:#F1F5F9;font-size:18px;margin:0 0 8px;font-weight:600;">${title}</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 16px;">${message}</p>
      ${actorName ? `<p style="color:#64748B;font-size:12px;margin:0;">From: <span style="color:#D4A843;font-weight:500;">${actorName}</span></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://soliscenter.com'}/app" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#D4A843,#B8922E);color:#06080F;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open Solis Center</a>
    </div>
    <p style="text-align:center;color:#475569;font-size:11px;margin-top:32px;">You're receiving this because you have email notifications enabled in Solis Center.</p>
  </div>
</body>
</html>`;

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: subject || `${typeLabel}: ${title}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error('Email error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
