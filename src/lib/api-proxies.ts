import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Proxies GET /auth/lnurl to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyAuthLnurlGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/lnurl');
}

/**
 * Proxies GET /auth/lnurl/callback to the 21.gifts api (wallet-facing LUD-04).
 *
 * @param request - Incoming App Router request (k1, sig, key query params).
 * @returns The upstream response.
 */
export async function proxyAuthLnurlCallbackGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/lnurl/callback');
}

/**
 * Proxies GET /auth/session to the 21.gifts api.
 *
 * @param request - Incoming App Router request (`X-Poll-Token` header).
 * @returns The upstream response.
 */
export async function proxyAuthSessionGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/session');
}

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
