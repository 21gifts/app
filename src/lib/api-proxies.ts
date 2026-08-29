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
 * Proxies GET /lightning-address to the 21.gifts api.
 *
 * @param request - Incoming App Router request (`address` query param).
 * @returns The upstream response.
 */
export async function proxyLightningAddressGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/lightning-address');
}

/**
 * Proxies GET /gifts/stats to the 21.gifts api.
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
 * Proxies GET /messages to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMessagesGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages');
}

/**
 * Proxies POST /messages to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMessagesPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages');
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
