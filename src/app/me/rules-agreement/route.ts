import { proxyMeRulesAgreementPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/rules-agreement`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeRulesAgreementPost;
