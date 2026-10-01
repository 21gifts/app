import { proxyFundingDailyRosterCommentPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/comment`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/comment`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ comment }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterCommentPost;
