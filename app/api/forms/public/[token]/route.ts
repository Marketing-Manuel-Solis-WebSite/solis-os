import { NextRequest, NextResponse } from 'next/server';
import { getFormByToken } from '@/lib/db-admin';
import { checkRateLimit } from '@/lib/rate-limit';

const TOKEN_FORMAT = /^[a-zA-Z0-9_-]+$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 8 || !TOKEN_FORMAT.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  // Rate limit: 30 req/min per IP
  const ip = _req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed } = await checkRateLimit('public-forms', ip, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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
