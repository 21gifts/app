import { proxyPublicMessageGet } from '@/lib/api-proxies';

/** App Router context for `/public-messages/[id]`. */
interface PublicMessageRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/public-messages/[id]`.
 *
 * Same-origin public proxy of api GET `/messages/:id` (no Bearer).
 * The HTML public note lives at `/messages/[id]`; this path is JSON only.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: PublicMessageRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyPublicMessageGet(request, id);
}
