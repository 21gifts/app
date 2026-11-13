import { proxyFondPaymentsGet, proxyFondSummaryGet } from '@/lib/api-proxies';
import { fondSummarySchema } from '@/lib/api-types';

/** App Router context for `/fonds/[username]/payments`. */
interface FondPaymentsRouteContext {
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
 * App Router GET for `/fonds/:username/payments`.
 *
 * Same-origin public proxy of api `GET /fond/payments`. The api answers for
 * its one Fond only, so this route first reads the public summary and answers
 * 404 for another handle (and for the api's own summary 404). Only then does
 * it forward `before` to the payments upstream. A malformed summary is treated
 * like an upstream failure; payment statuses are passed through unchanged.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`username`).
 * @returns The proxied payments response, or a 404 / 502 JSON answer.
 */
export async function GET(request: Request, context: FondPaymentsRouteContext): Promise<Response> {
  const { username } = await context.params;
  const summaryRequest = new Request(
    new URL(`/fonds/${encodeURIComponent(username)}/summary`, request.url),
  );
  const summary = await proxyFondSummaryGet(summaryRequest);
  if (summary.status !== 200) {
    return summary.status === 404 ? jsonResponse(404, { error: 'Not found' }) : summary;
  }
  const parsed = fondSummarySchema.safeParse(await summary.json().catch(() => undefined));
  if (!parsed.success) {
    return jsonResponse(502, { error: 'Upstream api returned an invalid Fond summary' });
  }
  if (parsed.data.username !== username) {
    return jsonResponse(404, { error: 'Not found' });
  }
  return proxyFondPaymentsGet(request);
}
