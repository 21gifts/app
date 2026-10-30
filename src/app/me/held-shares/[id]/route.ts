import { proxyMeHeldShareDelete, proxyMeHeldSharePut } from '@/lib/api-proxies';

/**
 * App Router PUT for `/me/held-shares/:id`.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `id` param.
 * @returns The proxied upstream response.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMeHeldSharePut(request, id);
}

/**
 * App Router DELETE for `/me/held-shares/:id`.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `id` param.
 * @returns The proxied upstream response.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMeHeldShareDelete(request, id);
}
