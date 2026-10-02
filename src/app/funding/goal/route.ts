import { proxyFundingGoalGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/funding/goal`.
 *
 * @param request - Incoming request. The bearer session is forwarded.
 * @returns The proxied upstream response.
 */
export const GET = proxyFundingGoalGet;
