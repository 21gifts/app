import { proxyLightningAddressGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/lightning-address`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyLightningAddressGet;
