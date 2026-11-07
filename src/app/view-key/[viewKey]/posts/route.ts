import { proxyViewListGet } from '@/lib/api-proxies';

/** App Router context for `/view-key/[viewKey]/posts`. */
interface ViewKeyPostsRouteContext {
  params: Promise<{ viewKey: string }>;
}

/**
 * App Router GET for `/view-key/:viewKey/posts`.
 *
 * Same-origin proxy of public api `GET /view/:viewKey/posts`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`viewKey`).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: ViewKeyPostsRouteContext): Promise<Response> {
  const { viewKey } = await context.params;
  return proxyViewListGet(request, viewKey, 'posts');
}
