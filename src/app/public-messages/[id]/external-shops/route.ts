import { proxyExternalAuthorShopsGet } from '@/lib/api-proxies';

/** App Router context for `/public-messages/[id]/external-shops`. */
interface ExternalAuthorShopsRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/public-messages/[id]/external-shops`.
 *
 * Same-origin public proxy of api GET `/messages/:id/external-shops`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: ExternalAuthorShopsRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyExternalAuthorShopsGet(request, id);
}
