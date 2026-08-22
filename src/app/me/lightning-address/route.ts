import { proxyMeLightningAddressDelete, proxyMeLightningAddressPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/lightning-address`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeLightningAddressPost;

/**
 * App Router DELETE for `/me/lightning-address`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const DELETE = proxyMeLightningAddressDelete;
