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

  it('does not proxy a parent-segment username', async () => {
    proxyMock.mockClear();
    const { GET } = await import('@/app/pay/[username]/route');
    const request = new Request('https://21.gifts/pay/..');
    const res = await GET(request, { params: Promise.resolve({ username: '..' }) });
    expect(res.status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
    const slash = await GET(request, { params: Promise.resolve({ username: 'a/b' }) });
    expect(slash.status).toBe(404);
    const dot = await GET(request, { params: Promise.resolve({ username: '.' }) });
    expect(dot.status).toBe(404);
    const backslash = await GET(request, { params: Promise.resolve({ username: 'a\\b' }) });
    expect(backslash.status).toBe(404);
  });
});
