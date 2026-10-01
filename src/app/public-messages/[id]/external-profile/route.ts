import { proxyExternalAuthorProfileGet } from '@/lib/api-proxies';

/** App Router context for `/public-messages/[id]/external-profile`. */
interface ExternalAuthorProfileRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/public-messages/[id]/external-profile`.
 *
 * Same-origin public proxy of api GET `/messages/:id/external-profile`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: ExternalAuthorProfileRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyExternalAuthorProfileGet(request, id);
}
