import { proxyViewActivityGet } from '@/lib/api-proxies';

/** App Router context for `/view-key/[viewKey]/activity`. */
interface ViewKeyActivityRouteContext {
  params: Promise<{ viewKey: string }>;
}

/**
 * App Router GET for `/view-key/:viewKey/activity`.
 *
 * Same-origin proxy of public api `GET /view/:viewKey/activity`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`viewKey`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: ViewKeyActivityRouteContext,
): Promise<Response> {
  const { viewKey } = await context.params;
  return proxyViewActivityGet(request, viewKey);
}
