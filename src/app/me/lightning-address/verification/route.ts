import { proxyMeLightningAddressVerificationPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/lightning-address/verification`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeLightningAddressVerificationPost;
