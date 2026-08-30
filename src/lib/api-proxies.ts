import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Proxies POST /auth/passkey/register/begin to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyRegisterBeginPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/register/begin');
}

/**
 * Proxies POST /auth/passkey/register/finish to the 21.gifts api.
 *
 * @param request - Incoming App Router request (JSON body).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyRegisterFinishPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/register/finish');
}

/**
 * Proxies POST /auth/passkey/authenticate/begin to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyAuthenticateBeginPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/authenticate/begin');
}

/**
 * Proxies POST /auth/passkey/authenticate/finish to the 21.gifts api.
 *
 * @param request - Incoming App Router request (JSON body).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyAuthenticateFinishPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/authenticate/finish');
}

/**
 * Proxies GET /me to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me');
}

/**
 * Proxies POST /me/name to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMeNamePost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/name');
}

/**
 * Proxies POST /me/forum-laws-dismissed to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeForumLawsDismissedPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/forum-laws-dismissed');
}

/**
 * Proxies POST /me/lightning-address to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMeLightningAddressPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/lightning-address');
}

/**
 * Proxies DELETE /me/lightning-address to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeLightningAddressDelete(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/lightning-address');
}

/**
 * Proxies POST /me/rules-agreement to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session, no body).
 * @returns The upstream response.
 */
export async function proxyMeRulesAgreementPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/rules-agreement');
}

/**
 * Proxies GET /lightning-address to the 21.gifts api.
 *
 * @param request - Incoming App Router request (`address` query param).
 * @returns The upstream response.
 */
export async function proxyLightningAddressGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/lightning-address');
}

/**
 * Proxies GET /gifts/stats to the 21.gifts api (forwards `recipient` query).
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyGiftsStatsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/gifts/stats');
}

/**
 * Proxies GET /gifts to the 21.gifts api (forwards `day` query).
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyGiftsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/gifts');
}

/**
 * Proxies GET /messages to the 21.gifts api (app path `/forum/messages`).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMessagesGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages');
}

/**
 * Proxies POST /messages to the 21.gifts api (app path `/forum/messages`).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMessagesPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages');
}

/**
 * Proxies GET /messages/:id/replies to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param messageId - Parent forum message UUID.
 * @returns The upstream response.
 */
export async function proxyMessagesRepliesGet(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/replies`);
}

/**
 * Proxies GET /messages/:id to the 21.gifts api (public; no auth).
 *
 * App path is `/public-messages/:id` so `/messages/:id` can serve HTML.
 *
 * @param request - Incoming App Router request.
 * @param messageId - Forum message UUID.
 * @returns The upstream response.
 */
export async function proxyPublicMessageGet(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}`);
}

/**
 * Proxies POST /messages/:id/invoice to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @param messageId - Forum message UUID from the public JSON.
 * @returns The upstream response.
 */
export async function proxyMessagesInvoicePost(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/invoice`);
}

/**
 * Proxies POST /contact to the 21.gifts api (same-origin path `/contact/submit`).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyContactPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/contact');
}

/**
 * Proxies GET /conversations to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyConversationsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/conversations');
}

/**
 * Proxies POST /conversations to the 21.gifts api (open from a forum note).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyConversationsPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/conversations');
}

/**
 * Proxies GET /conversations/:id to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param conversationId - Conversation UUID.
 * @returns The upstream response.
 */
export async function proxyConversationGet(
  request: Request,
  conversationId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/conversations/${encodeURIComponent(conversationId)}`);
}

/**
 * Proxies POST /conversations/:id to the 21.gifts api (append a reply).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @param conversationId - Conversation UUID.
 * @returns The upstream response.
 */
export async function proxyConversationPost(
  request: Request,
  conversationId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/conversations/${encodeURIComponent(conversationId)}`);
}

/**
 * Proxies GET /messages/:id/photo to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param id - Forum message id from the dynamic route segment.
 * @returns The upstream response (raw image bytes).
 */
export async function proxyMessagesPhotoGet(request: Request, id: string): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(id)}/photo`);
}

/**
 * Proxies GET /messages/:id/video.mp4, video.webm, or video.mov to the 21.gifts api (public; no auth).
 *
 * @param request - Incoming App Router request.
 * @param id - Forum message id from the dynamic route segment.
 * @param ext - Video file extension (`mp4` | `webm` | `mov`).
 * @returns The upstream response (raw video bytes).
 */
export async function proxyMessagesVideoGet(
  request: Request,
  id: string,
  ext: 'mp4' | 'webm' | 'mov',
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(id)}/video.${ext}`);
}

/**
 * Proxies GET /view/:viewKey to the 21.gifts api (public; no auth).
 *
 * @param request - Incoming App Router request.
 * @param viewKey - 64-hex view key from the URL.
 * @returns The upstream response.
 */
export async function proxyViewGet(request: Request, viewKey: string): Promise<Response> {
  return proxyApiRequest(request, `/view/${encodeURIComponent(viewKey)}`);
}

/**
 * Proxies GET /push/vapid-public to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyPushVapidPublicGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/push/vapid-public');
}

/**
 * Proxies POST /me/push-subscriptions to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMePushSubscriptionsPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/push-subscriptions');
}

/**
 * Proxies DELETE /me/push-subscriptions to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMePushSubscriptionsDelete(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/push-subscriptions');
}
