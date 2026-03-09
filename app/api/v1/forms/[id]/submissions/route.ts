import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../../../middleware';
import { getForm, getFormSubmissions, countSubcollection } from '@/lib/db-admin';

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

    const [result, realTotal] = await Promise.all([
      getFormSubmissions(id),
      countSubcollection(`forms/${id}`, 'submissions'),
    ]);

    let submissions = result.items as any[];
    if (status) submissions = submissions.filter((s: any) => s.status === status);

    const total = status ? submissions.length : realTotal;
    const paginated = submissions.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return apiResponse(paginated, { total, limit, offset, hasMore });
  } catch {
    return apiError('Internal error', 500);
  }
}
