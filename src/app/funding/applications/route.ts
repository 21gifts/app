import { proxyFundingApplicationsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/funding/applications`.
 *
 * Same-origin Bearer proxy of api GET `/funding/applications`. Lives under
 * `/funding/applications` because Next.js forbids a `route.ts` beside
 * `/moderate/applications`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyFundingApplicationsGet;
