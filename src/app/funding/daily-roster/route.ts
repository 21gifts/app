import { proxyFundingDailyRosterGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/funding/daily-roster`.
 *
 * Same-origin Bearer proxy of api GET `/funding/daily-roster`. Lives under
 * `/funding/daily-roster` because Next.js forbids a `route.ts` beside
 * `/grants/payments`. GET only; comment, payments, and recipient writes have
 * their own routes.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyFundingDailyRosterGet;
