import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * App Router GET for `/.well-known/nostr.json` (NIP-05).
 *
 * Damus fetches this from the site apex (`21.gifts` / `dev.21.gifts`).
 *
 * @param request - Incoming request (`?name=` optional).
 * @returns Proxied API directory with CORS `*`.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const upstream = await proxyApiRequest(request, `/.well-known/nostr.json${url.search}`);
  const headers = new Headers(upstream.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return new Response(upstream.body, { status: upstream.status, headers });
}

/**
 * CORS preflight for NIP-05 clients.
 *
 * @returns 204 with `Access-Control-Allow-Origin: *`.
 */
export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
