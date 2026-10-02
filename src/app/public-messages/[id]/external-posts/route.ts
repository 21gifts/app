import { proxyExternalAuthorPostsGet } from '@/lib/api-proxies';

/** App Router context for `/public-messages/[id]/external-posts`. */
interface ExternalAuthorPostsRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/public-messages/[id]/external-posts`.
 *
 * Same-origin public proxy of api GET `/messages/:id/external-posts`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: ExternalAuthorPostsRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyExternalAuthorPostsGet(request, id);
}
