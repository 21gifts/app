import { proxyMessagesPhotoExtGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/messages/[id]/photo.jpeg`.
 *
 * Public same-origin still. Authorization is not forwarded so the edge can cache.
 *
 * @param request - Incoming request.
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response (raw image bytes).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesPhotoExtGet(request, id, 'jpeg');
}
