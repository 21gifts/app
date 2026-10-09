import { proxyFundingDailyRosterModeratorsPaymentsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/moderators/payments`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/moderators/payments`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ enabled }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterModeratorsPaymentsPost;
