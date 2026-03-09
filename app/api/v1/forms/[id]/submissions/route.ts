import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../../../middleware';
import { getForm, getFormSubmissions } from '@/lib/db-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiRequest(req, 'forms:read');
    if (!auth.valid) return auth.error!;

    const { id } = await params;
    const form = await getForm(id);
    if (!form) return apiError('Form not found', 404);

    const { limit, offset } = parsePagination(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    let submissions = await getFormSubmissions(id) as any[];

    if (status) submissions = submissions.filter((s: any) => s.status === status);

    const total = submissions.length;
    const paginated = submissions.slice(offset, offset + limit);

    return apiResponse(paginated, { total, limit, offset });
  } catch {
    return apiError('Internal error', 500);
  }
}
