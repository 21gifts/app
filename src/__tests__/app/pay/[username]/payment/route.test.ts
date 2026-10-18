import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '@/lib/api-proxy';

vi.mock('@/lib/api-proxy', () => ({
  proxyApiRequest: vi.fn(async () => new Response('{"payment":"p"}', { status: 200 })),
}));

const proxyMock = vi.mocked(proxyApiRequest);

describe('POST /pay/:username/payment', () => {
  it('proxies the payment body to the api', async () => {
    const { POST } = await import('@/app/pay/[username]/payment/route');
    const request = new Request('https://21.gifts/pay/ada/payment', { method: 'POST' });
    const res = await POST(request, { params: Promise.resolve({ username: 'a da' }) });
    expect(res.status).toBe(200);
    expect(proxyMock).toHaveBeenCalledWith(request, '/pay/a%20da/payment');
  });

  it('does not proxy a parent-segment username', async () => {
    proxyMock.mockClear();
    const { POST } = await import('@/app/pay/[username]/payment/route');
    const request = new Request('https://21.gifts/pay/../payment', { method: 'POST' });
    const res = await POST(request, { params: Promise.resolve({ username: '..' }) });
    expect(res.status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
    const slash = await POST(request, { params: Promise.resolve({ username: 'a/b' }) });
    expect(slash.status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
    const dot = await POST(request, { params: Promise.resolve({ username: '.' }) });
    expect(dot.status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
    const backslash = await POST(request, { params: Promise.resolve({ username: 'a\\b' }) });
    expect(backslash.status).toBe(404);
    expect(proxyMock).toHaveBeenCalledTimes(0);
  });
});
