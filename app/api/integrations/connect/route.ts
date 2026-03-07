import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '@/lib/integrations-crypto';
import { addIntegration, getIntegrationByProvider, updateIntegration } from '@/lib/integrations-db';
import { authenticateRequest } from '@/lib/server-auth';
import { INTEGRATION_CATALOG } from '@/lib/integrations-catalog';
import type { IntegrationProvider } from '@/lib/integrations-types';

export async function POST(req: NextRequest) {
  try {
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey } = body as {
      provider: string;
      apiKey: string;
    };

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API key required' }, { status: 400 });
    }

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
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
