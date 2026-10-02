import { proxyFundingDailyRosterRecipientsUpdatePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/funding/daily-roster/recipients/update`.
 *
 * Same-origin Bearer proxy of api POST `/funding/daily-roster/recipients/update`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ address, amountUsd }`).
 * @returns The proxied upstream response.
 */
export const POST = proxyFundingDailyRosterRecipientsUpdatePost;
