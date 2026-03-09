import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '@/lib/integrations-crypto';
import { addIntegration, getIntegrationByProvider, updateIntegration } from '@/lib/integrations-db-admin';
import { authenticateAdmin } from '@/lib/server-auth';
import { INTEGRATION_CATALOG } from '@/lib/integrations-catalog';
import { IntegrationConnectSchema, formatZodError } from '@/lib/validation';
import type { IntegrationProvider } from '@/lib/integrations-types';

export async function POST(req: NextRequest) {
  try {
    const authedUser = await authenticateAdmin(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized – admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = IntegrationConnectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error) }, { status: 400 });
    }

    const { provider, apiKey } = parsed.data;

    const catalogEntry = INTEGRATION_CATALOG.find(i => i.provider === provider);
    if (!catalogEntry) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    const encryptedKey = encryptToken(apiKey);

    const existing = await getIntegrationByProvider(provider as IntegrationProvider);

    if (existing) {
      await updateIntegration(existing.id, {
        status: 'connected',
        config: { apiKey: encryptedKey },
      });
    } else {
      await addIntegration({
        provider: provider as IntegrationProvider,
        category: catalogEntry.category,
        status: 'connected',
        displayName: catalogEntry.name,
        config: { apiKey: encryptedKey },
        createdBy: authedUser.uid,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
