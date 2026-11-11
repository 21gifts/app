import { proxyFondSummaryGet } from '@/lib/api-proxies';
import { fondSummarySchema } from '@/lib/api-types';

/** App Router context for `/fonds/[username]/summary`. */
interface FondSummaryRouteContext {
  params: Promise<{ username: string }>;
}

/** JSON headers for a locally built answer. */
const JSON_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
} as const;

/**
 * Builds a local JSON answer with the route's headers.
 *
 * @param status - HTTP status.
 * @param body - JSON body.
 * @returns The response.
 */
function jsonResponse(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Parses a response body as JSON without throwing.
 *
 * @param body - Raw text from the upstream response.
 * @returns The parsed value, or `undefined` when the text is not JSON.
 */
function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * App Router GET for `/fonds/:username/summary`.
 *
 * Same-origin public proxy of api `GET /fond/summary`. The api answers for
 * its one Fond only, so a 200 body whose `username` is not this route's
 * handle becomes 404 (the page shows not-found). A malformed 200 body is
 * treated like an upstream failure.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`username`).
 * @returns The proxied upstream response, or a 404 / 502 JSON answer.
 */
export async function GET(request: Request, context: FondSummaryRouteContext): Promise<Response> {
  const { username } = await context.params;
  const upstream = await proxyFondSummaryGet(request);
  if (upstream.status !== 200) {
    return upstream;
  }
  const headers = new Headers(upstream.headers);
  const body = await upstream.text();
  const parsed = fondSummarySchema.safeParse(parseJson(body));
  if (!parsed.success) {
    return jsonResponse(502, { error: 'Upstream api returned an invalid Fond summary' });
  }
  if (parsed.data.username !== username) {
    return jsonResponse(404, { error: 'Not found' });
  }
  headers.set('content-type', JSON_HEADERS['content-type']);
  headers.set('cache-control', JSON_HEADERS['cache-control']);
  return new Response(body, { status: 200, headers });
}
