import { proxyPublicMessageRepliesGet } from '@/lib/api-proxies';

/** App Router context for `/public-messages/[id]/replies`. */
interface PublicMessageRepliesRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/public-messages/[id]/replies`.
 *
 * Same-origin public proxy of api GET `/messages/:id/replies` (no Bearer).
 * The HTML public thread lives at `/messages/[id]`; this path is JSON only.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: PublicMessageRepliesRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyPublicMessageRepliesGet(request, id);
}
