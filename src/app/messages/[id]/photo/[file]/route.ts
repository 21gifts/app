import { proxyMessagesPhotoGet } from '@/lib/api-proxies';

/**
 * App Router GET for an indexed forum photo at `/messages/[id]/photo/[file]`.
 *
 * @param request - Incoming request (public / optional Authorization).
 * @param context - Dynamic route params (`id`, `file`).
 * @returns The proxied image response, or 404 for an unsupported filename.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; file: string }> },
): Promise<Response> {
  const { id, file } = await context.params;
  const match = /^([1-9])\.(jpg|jpeg|png|webp)$/i.exec(file);
  if (match === null) {
    return new Response(null, { status: 404 });
  }
  return proxyMessagesPhotoGet(request, id, `${match[1]}.jpg`);
}
