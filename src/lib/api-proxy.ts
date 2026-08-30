import { getApiUrl } from '@/lib/config';

/** Incoming headers that the api accepts and that the browser sends. */
const FORWARDED_HEADERS = [
  'authorization',
  'content-type',
  'origin',
  'user-agent',
  'range',
] as const;

/** Upstream response headers copied onto the client response when present. */
const RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'cache-control',
  'content-disposition',
] as const;

/** HTTP methods that carry a body to the api. */
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Forwards an App Router request to the 21.gifts api.
 *
 * Used so the browser talks to the public apex (`21.gifts`) while the api
 * process still listens at `api.21.gifts`. Request bodies stream through
 * (multipart video uploads) with `duplex: 'half'`; `Range` is forwarded for
 * partial GETs.
 *
 * @param request - Incoming request (query string and body are forwarded).
 * @param apiPath - Path on the api beginning with `/` (e.g. `/me`).
 * @returns The upstream response (status, selected headers, body), or 502 JSON
 * when the api URL is missing or fetch fails.
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
      init.body = request.body;
      (init as RequestInit & { duplex?: string }).duplex = 'half';
    }

    const upstream = await fetch(destination, init);
    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value !== null) {
        responseHeaders.set(name, value);
      }
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
