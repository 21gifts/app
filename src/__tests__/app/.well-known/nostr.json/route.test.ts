import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '@/lib/api-proxy';

vi.mock('@/lib/api-proxy', () => ({
  proxyApiRequest: vi.fn(async () => new Response('{"names":{}}', { status: 200 })),
}));

const proxyMock = vi.mocked(proxyApiRequest);

describe('GET /.well-known/nostr.json', () => {
  it('proxies and sets CORS', async () => {
    const { GET } = await import('@/app/.well-known/nostr.json/route');
    const request = new Request('https://21.gifts/.well-known/nostr.json?name=ada');
    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(proxyMock).toHaveBeenCalledWith(request, '/.well-known/nostr.json?name=ada');
  });
});

describe('OPTIONS /.well-known/nostr.json', () => {
  it('returns 204 CORS', async () => {
    const { OPTIONS } = await import('@/app/.well-known/nostr.json/route');
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
  });
});
