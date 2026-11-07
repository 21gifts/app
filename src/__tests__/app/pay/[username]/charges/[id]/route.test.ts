import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '@/lib/api-proxy';

vi.mock('@/lib/api-proxy', () => ({
  proxyApiRequest: vi.fn(async () => new Response('{"id":"chg"}', { status: 200 })),
}));

const proxyMock = vi.mocked(proxyApiRequest);

describe('GET /pay/:username/charges/:id', () => {
  it('proxies the username and charge id to the api', async () => {
    const { GET } = await import('@/app/pay/[username]/charges/[id]/route');
    const request = new Request('https://21.gifts/pay/my%20shop/charges/chg_abc');
    const res = await GET(request, {
      params: Promise.resolve({ username: 'my shop', id: 'chg_abc' }),
    });
    expect(res.status).toBe(200);
    expect(proxyMock).toHaveBeenCalledWith(request, '/pay/my%20shop/charges/chg_abc');
  });

  it('does not proxy a parent-segment username or id', async () => {
    proxyMock.mockClear();
    const { GET } = await import('@/app/pay/[username]/charges/[id]/route');
    const request = new Request('https://21.gifts/pay/../charges/chg');
    const res = await GET(request, { params: Promise.resolve({ username: '..', id: 'chg' }) });
    expect(res.status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
    const slash = await GET(request, { params: Promise.resolve({ username: 'ada', id: 'a/b' }) });
    expect(slash.status).toBe(404);
    const empty = await GET(request, { params: Promise.resolve({ username: '', id: 'chg' }) });
    expect(empty.status).toBe(404);
  });
});
