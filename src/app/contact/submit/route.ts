import { proxyContactPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/contact/submit`.
 *
 * Same-origin proxy of api `POST /contact`. The UI lives at `/contact`
 * (`page.tsx`); this nested route avoids colliding with that page.
 *
 * @param request - Incoming request (Bearer session + JSON body).
 * @returns The proxied upstream response.
 */
export const POST = proxyContactPost;
