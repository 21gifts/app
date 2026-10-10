import { proxyMeLoansGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/me/loans`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyMeLoansGet;
