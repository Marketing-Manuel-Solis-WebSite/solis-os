import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey } from '@/lib/integrations-crypto';
import { addApiKey } from '@/lib/integrations-db-admin';
import { requireAdmin } from '@/lib/server-auth';
import { ApiKeyCreateSchema, formatZodError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const authedOrErr = await requireAdmin(req);
    if (authedOrErr instanceof Response) return authedOrErr;
    const authedUser = authedOrErr;

    const rl = await checkRateLimit('integrations', authedUser.uid, 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = ApiKeyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error) }, { status: 400 });
    }

    const { name, scopes, expiresAt } = parsed.data;
    const { raw, hash, prefix } = generateApiKey();

    await addApiKey({
      name,
      keyHash: hash,
      prefix,
      scopes,
      createdBy: authedUser.uid,
      expiresAt,
    });

    return NextResponse.json({ ok: true, raw, prefix });
  } catch (err) {
    console.error('[Integrations] API key creation failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
