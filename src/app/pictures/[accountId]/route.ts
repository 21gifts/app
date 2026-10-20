import { proxyPublicProfileSlotGet } from '@/lib/api-proxies';

/** App Router context for `/pictures/[accountId]`. */
interface PublicProfilePhotoRouteContext {
  params: Promise<{ accountId: string }>;
}

/**
 * App Router GET for `/pictures/:accountId`.
 *
 * Same-origin public proxy of api `GET /pictures/:accountId.jpg|.png|.webp`.
 * No bearer. A missing photo is 404. Not the wide image and not the About me photo.
 *
 * @param request - Incoming request.
 * @param context - Dynamic route params (`accountId`).
 * @returns The proxied image, or 404.
 */
export async function GET(
  request: Request,
  context: PublicProfilePhotoRouteContext,
): Promise<Response> {
  const { accountId } = await context.params;
  return proxyPublicProfileSlotGet(request, 'pictures', accountId);
}
