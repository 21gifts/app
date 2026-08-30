import { proxyMessagesVideoGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/messages/[id]/[file]` (forum video bytes).
 *
 * @param request - Incoming request.
 * @param context - Dynamic route params (`id`, `file`).
 * @returns The proxied upstream response, or 404 when `file` is not a known video name.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; file: string }> },
): Promise<Response> {
  const { id, file } = await context.params;
  if (file === 'video.mp4') {
    return proxyMessagesVideoGet(request, id, 'mp4');
  }
  if (file === 'video.webm') {
    return proxyMessagesVideoGet(request, id, 'webm');
  }
  if (file === 'video.mov') {
    return proxyMessagesVideoGet(request, id, 'mov');
  }
  return new Response(null, { status: 404 });
}
