import { proxyNotificationsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/forum/notifications`.
 *
 * Same-origin Bearer proxy of api GET `/notifications`.
 * HTML `/notifications` is the page (Next.js forbids `route.ts` beside that
 * `page.tsx`); notification HTTP lives here.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyNotificationsGet;
