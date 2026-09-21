import { proxyAuthPasskeyReplaceBeginPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/replace/begin`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyReplaceBeginPost;
