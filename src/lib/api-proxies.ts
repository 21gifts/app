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
 * Proxies GET /me to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me');
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
