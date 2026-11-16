import { proxyFundingWithdrawPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/withdraw`.
 *
 * Same-origin Bearer proxy of api POST `/funding/withdraw`. The caller
 * withdraws their own grant application or grant place; this route forwards
 * the api status.
 *
 * @param request - Incoming request (Bearer session, no body).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingWithdrawPost;
