import { NextResponse, type NextRequest } from 'next/server';

/**
 * Old `/map` links open the shops map.
 *
 * The query string is kept, so `/map?pin=` still selects that pin on
 * `/shops?pin=#map`. There is no map page.
 *
 * @param request - The incoming `/map` request.
 * @returns A redirect to the shops map.
 */
export function middleware(request: NextRequest): NextResponse {
  const destination = new URL('/shops', request.url);
  destination.search = request.nextUrl.search;
  destination.hash = 'map';
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: '/map',
};
