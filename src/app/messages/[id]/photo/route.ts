import { proxyMessagesPhotoGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/messages/[id]/photo`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response (raw image bytes).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesPhotoGet(request, id);
}
