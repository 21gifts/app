import { proxyAuthPasskeyReplaceFinishPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/replace/finish`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyReplaceFinishPost;
