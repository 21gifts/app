import { proxyFundingDailyRosterModeratorsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/moderators`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/moderators`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ accountId, amountUsd }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterModeratorsPost;
