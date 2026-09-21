import { proxyFundingRejectPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/reject`.
 *
 * Same-origin Bearer proxy of api POST `/funding/reject`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ accountId }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingRejectPost;
