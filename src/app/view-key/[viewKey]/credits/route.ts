import { proxyViewListGet } from '@/lib/api-proxies';

/** App Router context for `/view-key/[viewKey]/credits`. */
interface ViewKeyCreditsRouteContext {
  params: Promise<{ viewKey: string }>;
}

/**
 * App Router GET for `/view-key/:viewKey/credits`.
 *
 * Same-origin proxy of public api `GET /view/:viewKey/credits`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`viewKey`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: ViewKeyCreditsRouteContext,
): Promise<Response> {
  const { viewKey } = await context.params;
  return proxyViewListGet(request, viewKey, 'credits');
}
