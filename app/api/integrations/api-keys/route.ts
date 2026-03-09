import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey } from '@/lib/integrations-crypto';
import { addApiKey } from '@/lib/integrations-db-admin';
import { authenticateAdmin } from '@/lib/server-auth';
import { ApiKeyCreateSchema, formatZodError } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const authedUser = await authenticateAdmin(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized – admin role required' }, { status: 403 });
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
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
