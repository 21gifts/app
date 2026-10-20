import { proxyFundingDailyRosterModeratorsDeletePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/moderators/delete`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/moderators/delete`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ address }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterModeratorsDeletePost;
