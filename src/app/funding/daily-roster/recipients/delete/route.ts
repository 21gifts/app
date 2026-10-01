import { proxyFundingDailyRosterRecipientsDeletePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/recipients/delete`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/recipients/delete`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ address }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterRecipientsDeletePost;
