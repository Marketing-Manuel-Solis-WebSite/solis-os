import { NextRequest, NextResponse } from 'next/server';
import { getFormByToken } from '@/lib/db-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const form = await getFormByToken(token);
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  // Only expose fields needed by the public renderer — never leak internal/sensitive data
  const { id, title, description, status, fields, layout, logoUrl, successMessage,
    redirectUrl, responseLimit, openAt, closeAt,
    captchaEnabled, consentRequired, privacyNotice,
  } = form as any;

  return NextResponse.json({
    id, title, description, status, fields, layout, logoUrl, successMessage,
    redirectUrl, responseLimit, openAt, closeAt,
    captchaEnabled, consentRequired, privacyNotice,
    // publicToken, responseCount, collectIp, collectUserAgent deliberately excluded
  });
}
