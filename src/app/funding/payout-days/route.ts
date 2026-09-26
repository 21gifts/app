import { proxyFundingPayoutDaysGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/funding/payout-days`.
 *
 * Same-origin Bearer proxy of api GET `/funding/payout-days`. Lives under
 * `/funding/payout-days` because Next.js forbids a `route.ts` beside
 * `/moderate/payouts`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyFundingPayoutDaysGet;
