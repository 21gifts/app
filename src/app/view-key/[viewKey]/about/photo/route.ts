import { proxyViewAboutPhotoGet } from '@/lib/api-proxies';

/** App Router context for `/view-key/[viewKey]/about/photo`. */
interface ViewKeyAboutPhotoRouteContext {
  params: Promise<{ viewKey: string }>;
}

/**
 * App Router GET for `/view-key/:viewKey/about/photo`.
 *
 * Same-origin proxy of public api `GET /view/:viewKey/about/photo`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`viewKey`).
 * @returns The proxied upstream response (raw image bytes).
 */
export async function GET(
  request: Request,
  context: ViewKeyAboutPhotoRouteContext,
): Promise<Response> {
  const { viewKey } = await context.params;
  return proxyViewAboutPhotoGet(request, viewKey);
}
