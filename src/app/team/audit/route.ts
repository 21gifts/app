import { proxyTeamAuditGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/team/audit`.
 *
 * Same-origin Bearer proxy of api `GET /team/audit` (access log for
 * `/moderate/audit`). Lives under `/team` because Next.js forbids a
 * `route.ts` beside that page.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyTeamAuditGet;
