import { proxyViewListGet } from '@/lib/api-proxies';

/** App Router context for `/view-key/[viewKey]/shops`. */
interface ViewKeyShopsRouteContext {
  params: Promise<{ viewKey: string }>;
}

/**
 * App Router GET for `/view-key/:viewKey/shops`.
 *
 * Same-origin proxy of public api `GET /view/:viewKey/shops`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`viewKey`).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: ViewKeyShopsRouteContext): Promise<Response> {
  const { viewKey } = await context.params;
  return proxyViewListGet(request, viewKey, 'shops');
}
