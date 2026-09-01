import { proxyConversationsGet, proxyConversationsPost } from '@/lib/api-proxies';

/**
 * App Router GET for `/conversations`.
 *
 * Same-origin Bearer proxy of api GET `/conversations`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyConversationsGet;

/**
 * App Router POST for `/conversations`.
 *
 * Same-origin Bearer proxy of api POST `/conversations` (open from a forum
 * note via `{ forumMessageId }`).
 *
 * @param request - Incoming request (Bearer session + JSON body).
 * @returns The proxied upstream response.
 */
export const POST = proxyConversationsPost;
