import { proxyFundingApplyPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/apply`.
 *
 * Same-origin Bearer proxy of api POST `/funding/apply`. The api refuses
 * everyone except `joey-rosima`, `vincent`, and `jewel-bacolbas` while
 * applications are paused. This route forwards that status.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingApplyPost;
