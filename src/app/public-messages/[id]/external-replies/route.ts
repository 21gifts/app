import { proxyExternalAuthorRepliesGet } from '@/lib/api-proxies';

/** App Router context for `/public-messages/[id]/external-replies`. */
interface ExternalAuthorRepliesRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/public-messages/[id]/external-replies`.
 *
 * Same-origin public proxy of api GET `/messages/:id/external-replies`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: ExternalAuthorRepliesRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyExternalAuthorRepliesGet(request, id);
}
