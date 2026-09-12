import { proxyTrustChainGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/trust/graph`.
 *
 * Same-origin proxy of api `GET /trust-chain`. Lives under `/trust/graph` so
 * it does not collide with the marketing page at `/trust-chain`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyTrustChainGet;
