import { proxyPublicProfileSlotGet } from '@/lib/api-proxies';

/** App Router context for `/banners/[accountId]`. */
interface PublicWideBannerRouteContext {
  params: Promise<{ accountId: string }>;
}

/**
 * App Router GET for `/banners/:accountId`.
 *
 * Same-origin public proxy of api `GET /banners/:accountId.jpg|.png|.webp`.
 * No bearer. A missing wide image is 404. Not the profile photo and not the About me photo.
 *
 * @param request - Incoming request.
 * @param context - Dynamic route params (`accountId`).
 * @returns The proxied image, or 404.
 */
export async function GET(
  request: Request,
  context: PublicWideBannerRouteContext,
): Promise<Response> {
  const { accountId } = await context.params;
  return proxyPublicProfileSlotGet(request, 'banners', accountId);
}
