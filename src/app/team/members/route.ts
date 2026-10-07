import { proxyTeamMembersGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/team/members`.
 *
 * Same-origin Bearer proxy of api `GET /team/members?query=` (staff member
 * search for `/moderate/members`).
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyTeamMembersGet;
