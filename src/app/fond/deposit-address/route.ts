import { proxyFondDepositAddressPut } from '@/lib/api-proxies';

/**
 * App Router PUT for `/fond/deposit-address`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const PUT = proxyFondDepositAddressPut;
