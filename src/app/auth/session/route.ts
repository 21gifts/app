import { proxyAuthSessionGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/auth/session`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyAuthSessionGet;
