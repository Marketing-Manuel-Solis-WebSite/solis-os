import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey } from '@/lib/integrations-crypto';
import { addApiKey } from '@/lib/integrations-db';
import type { ApiKeyScope } from '@/lib/integrations-types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, scopes, expiresAt, createdBy } = body as {
      name: string;
      scopes: ApiKeyScope[];
      expiresAt: number | null;
      createdBy: string;
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
      createdBy: createdBy || '',
      expiresAt,
    });

    return NextResponse.json({ ok: true, raw, prefix });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
