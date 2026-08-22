import { proxyMeLightningAddressVerificationConfirmPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/lightning-address/verification/confirm`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeLightningAddressVerificationConfirmPost;
