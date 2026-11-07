import { getApiUrl } from '@/lib/config';

/** Incoming headers that the api accepts and that the browser sends. */
const FORWARDED_HEADERS = [
  'authorization',
  'content-type',
  'time-zone',
  'content-length',
  'origin',
  'user-agent',
  'range',
  // Build id of the browser's bundle (passkey begin and finish). Passed through
  // as sent, never set here: the server's own build would hide an outdated tab.
  'x-app-build',
  // Signature headers the in-app wallet sends with its address calls.
  'x-breez-signature',
  'x-breez-timestamp',
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
 * process still listens at `api.21.gifts`. Multipart video uploads stream
 * with `duplex: 'half'`; JSON and other bodies are buffered so Node fetch
 * does not throw. `Range` is forwarded for partial GETs.
 *
 * @param request - Incoming request (query string and body are forwarded).
 * @param apiPath - Path on the api beginning with `/` (e.g. `/me`).
 * @param options - `forwardAbort` passes the incoming request's abort signal to
 * the upstream fetch, so the api sees a client that disconnected; off by default.
 * @returns The upstream response (status, selected headers, body), or 502 JSON
 * when the api URL is missing or fetch fails.
 */
export async function proxyApiRequest(
  request: Request,
  apiPath: string,
  options: { forwardAbort?: boolean } = {},
): Promise<Response> {
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
    if (options.forwardAbort === true) {
      init.signal = request.signal;
    }
    if (
      BODY_METHODS.has(request.method) &&
      request.body !== null &&
      request.headers.get('content-length') !== '0'
    ) {
      const contentType = request.headers.get('content-type') ?? '';
      if (contentType.includes('multipart/')) {
        init.body = request.body;
        (init as RequestInit & { duplex?: string }).duplex = 'half';
      } else {
        init.body = await request.arrayBuffer();
      }
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
