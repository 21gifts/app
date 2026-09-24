import { NextResponse } from 'next/server';

/**
 * GET /maps/key — browser map key, or null when unset.
 *
 * An empty value must not fail boot. The key is never logged.
 *
 * @returns `{ key: string | null }` with status 200.
 */
export function GET(): NextResponse {
  const value = process.env['GOOGLE_MAPS_API_KEY'];
  if (typeof value !== 'string') {
    return NextResponse.json({ key: null });
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return NextResponse.json({ key: null });
  }
  return NextResponse.json({ key: trimmed });
}
