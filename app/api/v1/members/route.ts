import { NextRequest } from 'next/server';
import { validateApiRequest, apiResponse, apiError, parsePagination } from '../middleware';
import { getMembers } from '@/lib/db-admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiRequest(req, 'members:read');
    if (!auth.valid) return auth.error!;

    const { limit, offset } = parsePagination(req);
    const url = new URL(req.url);
    const teamId = url.searchParams.get('teamId');
    const active = url.searchParams.get('active');

    let members = await getMembers() as any[];

    if (teamId) members = members.filter((m: any) => m.teamId === teamId || m.teamIds?.includes(teamId));
    if (active === 'true') members = members.filter((m: any) => m.active !== false);
    if (active === 'false') members = members.filter((m: any) => m.active === false);

    const total = members.length;
    const paginated = members.slice(offset, offset + limit);

    // Strip sensitive fields
    const safe = paginated.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      teamId: m.teamId,
      teamIds: m.teamIds,
      title: m.title,
      department: m.department,
      active: m.active,
      photoURL: m.photoURL,
    }));

    const hasMore = offset + limit < total;
    return apiResponse(safe, { total, limit, offset, hasMore });
  } catch {
    return apiError('Internal error', 500);
  }
}
