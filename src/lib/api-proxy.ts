import { getApiUrl } from '@/lib/config';

/** Incoming headers that the api accepts and that the browser/wallet send. */
const FORWARDED_HEADERS = ['authorization', 'content-type', 'x-poll-token', 'user-agent'] as const;

/** HTTP methods that carry a body to the api. */
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Forwards an App Router request to the 21.gifts api.
 *
 * Used so the browser and LNURL-auth wallets talk to the public apex
 * (`21.gifts`) while the api process still listens at `api.21.gifts`.
 *
 * @param request - Incoming request (query string and body are forwarded).
 * @param apiPath - Path on the api beginning with `/` (e.g. `/auth/lnurl`).
 * @returns The upstream response (status, content-type, body), or 502 JSON
 * when the api URL is missing, the body cannot be read, or fetch fails.
 */
export async function proxyApiRequest(request: Request, apiPath: string): Promise<Response> {
  try {
    const incoming = new URL(request.url);
    const destination = new URL(apiPath, `${getApiUrl()}/`);
    destination.search = incoming.search;

    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value !== null) {
        headers.set(name, value);
      }
    }

    const init: RequestInit = {
      method: request.method,
      headers,
    };
    if (BODY_METHODS.has(request.method)) {
      init.body = await request.arrayBuffer();
    }

    const upstream = await fetch(destination, init);
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType !== null) {
      responseHeaders.set('content-type', contentType);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream api unreachable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
