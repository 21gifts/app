import { proxyFundingTrialPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/trial`.
 *
 * Same-origin Bearer proxy of api POST `/funding/trial`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ accountId }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingTrialPost;
