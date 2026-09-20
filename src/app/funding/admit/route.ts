import { proxyFundingAdmitPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/admit`.
 *
 * Same-origin Bearer proxy of api POST `/funding/admit`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ accountId }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingAdmitPost;
