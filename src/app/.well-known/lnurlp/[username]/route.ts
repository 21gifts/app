import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * App Router GET for `/.well-known/lnurlp/:username` (LUD-16).
 *
 * Wallets fetch this from the site apex (`21.gifts` / `dev.21.gifts`).
 *
 * @param request - Incoming request.
 * @param context - Dynamic `username` param.
 * @returns Proxied API payRequest with CORS `*`.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await context.params;
  const upstream = await proxyApiRequest(
    request,
    `/.well-known/lnurlp/${encodeURIComponent(username)}`,
  );
  const headers = new Headers(upstream.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return new Response(upstream.body, { status: upstream.status, headers });
}

/**
 * CORS preflight for Lightning wallets.
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
