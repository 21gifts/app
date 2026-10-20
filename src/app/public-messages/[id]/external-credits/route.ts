import { proxyExternalAuthorCreditsGet } from '@/lib/api-proxies';

/** App Router context for `/public-messages/[id]/external-credits`. */
interface ExternalAuthorCreditsRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/public-messages/[id]/external-credits`.
 *
 * Same-origin public proxy of api GET `/messages/:id/external-credits`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: ExternalAuthorCreditsRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyExternalAuthorCreditsGet(request, id);
}
