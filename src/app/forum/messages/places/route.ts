import { proxyMessagesPlacesGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/forum/messages/places`.
 *
 * Same-origin Bearer proxy of api GET `/messages/places`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyMessagesPlacesGet;
