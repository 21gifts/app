import { proxyApiRequest } from '@/lib/api-proxy';

/** Public week history, with the query string forwarded to the API. */
export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/habit-tracker');
}
/** Authenticated owner operations and tracker-only comments. */
export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/habit-tracker');
}
