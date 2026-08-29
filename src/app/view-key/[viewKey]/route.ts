import { proxyViewGet } from '@/lib/api-proxies';

/** App Router context for `/view-key/[viewKey]`. */
interface ViewKeyRouteContext {
  params: Promise<{ viewKey: string }>;
}

/**
 * App Router GET for `/view-key/:viewKey`.
 *
 * Same-origin proxy of public api `GET /view/:viewKey`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`viewKey`).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: ViewKeyRouteContext): Promise<Response> {
  const { viewKey } = await context.params;
  return proxyViewGet(request, viewKey);
}
