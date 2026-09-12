import { proxyNotificationReadPost } from '@/lib/api-proxies';

/** App Router context for `/forum/notifications/[id]/read`. */
interface NotificationReadRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/forum/notifications/[id]/read`.
 *
 * Same-origin Bearer proxy of api POST `/notifications/:id/read`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function POST(
  request: Request,
  context: NotificationReadRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyNotificationReadPost(request, id);
}
