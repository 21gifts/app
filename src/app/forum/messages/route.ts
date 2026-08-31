import { proxyMessagesGet, proxyMessagesPost } from '@/lib/api-proxies';

/**
 * App Router GET for `/forum/messages`.
 *
 * Same-origin Bearer proxy of api GET `/messages`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyMessagesGet;

/**
 * App Router POST for `/forum/messages`.
 *
 * Same-origin Bearer proxy of api POST `/messages`.
 *
 * @param request - Incoming request (Bearer session + JSON body).
 * @returns The proxied upstream response.
 */
export const POST = proxyMessagesPost;
