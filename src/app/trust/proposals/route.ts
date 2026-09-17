import { proxyTrustProposalsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/trust/proposals`.
 *
 * Same-origin Bearer proxy of api GET `/trust/proposals`. Lives under
 * `/trust/proposals` because Next.js forbids a `route.ts` beside `/moderate`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyTrustProposalsGet;
