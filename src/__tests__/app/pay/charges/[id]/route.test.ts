import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '@/lib/api-proxy';

vi.mock('@/lib/api-proxy', () => ({
  proxyApiRequest: vi.fn(async () => new Response('{"id":"chg"}', { status: 200 })),
}));

const proxyMock = vi.mocked(proxyApiRequest);

describe('GET /pay/charges/:id', () => {
  it('proxies the charge id to the api', async () => {
    const { GET } = await import('@/app/pay/charges/[id]/route');
    const request = new Request('https://21.gifts/pay/charges/chg%20abc');
    const res = await GET(request, { params: Promise.resolve({ id: 'chg abc' }) });
    expect(res.status).toBe(200);
    expect(proxyMock).toHaveBeenCalledWith(request, '/pay/charges/chg%20abc');
  });

  it('does not proxy a parent-segment id', async () => {
    proxyMock.mockClear();
    const { GET } = await import('@/app/pay/charges/[id]/route');
    const request = new Request('https://21.gifts/pay/charges/..');
    const res = await GET(request, { params: Promise.resolve({ id: '..' }) });
    expect(res.status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
    const slash = await GET(request, { params: Promise.resolve({ id: 'a/b' }) });
    expect(slash.status).toBe(404);
    const empty = await GET(request, { params: Promise.resolve({ id: '' }) });
    expect(empty.status).toBe(404);
  });
});
