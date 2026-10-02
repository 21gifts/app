import { proxyFundingDailyRosterPaymentsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/payments`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/payments`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ enabled }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterPaymentsPost;
