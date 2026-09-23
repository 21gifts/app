import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '@/lib/api-proxy';

vi.mock('@/lib/api-proxy', () => ({
  proxyApiRequest: vi.fn(async () => new Response('{"name":"Ada"}', { status: 200 })),
}));

const proxyMock = vi.mocked(proxyApiRequest);

describe('GET /pay/:username', () => {
  it('proxies the username to the api', async () => {
    const { GET } = await import('@/app/pay/[username]/route');
    const request = new Request('https://21.gifts/pay/ada');
    const res = await GET(request, { params: Promise.resolve({ username: 'ada' }) });
    expect(res.status).toBe(200);
    expect(proxyMock).toHaveBeenCalledWith(request, '/pay/ada');
  });
});
