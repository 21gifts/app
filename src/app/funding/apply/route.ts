import { proxyFundingApplyPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/apply`.
 *
 * Same-origin Bearer proxy of api POST `/funding/apply`. Applications are
 * open to every verified member; this route forwards the api status.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingApplyPost;
