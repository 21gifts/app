import { proxyFundingDailyRosterModeratorsUpdatePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/moderators/update`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/moderators/update`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ address, amountUsd }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterModeratorsUpdatePost;
