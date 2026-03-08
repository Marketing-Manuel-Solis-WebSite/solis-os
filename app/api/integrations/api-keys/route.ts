import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey } from '@/lib/integrations-crypto';
import { addApiKey } from '@/lib/integrations-db-admin';
import { authenticateRequest } from '@/lib/server-auth';
import type { ApiKeyScope } from '@/lib/integrations-types';

export async function POST(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, scopes, expiresAt } = body as {
      name: string;
      scopes: ApiKeyScope[];
      expiresAt: number | null;
    };

    if (!name?.trim() || !scopes?.length) {
      return NextResponse.json({ error: 'Name and scopes required' }, { status: 400 });
    }

    const { raw, hash, prefix } = generateApiKey();

    await addApiKey({
      name: name.trim(),
      keyHash: hash,
      prefix,
      scopes,
      createdBy: authedUser.uid,
      expiresAt,
    });

    return NextResponse.json({ ok: true, raw, prefix });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
