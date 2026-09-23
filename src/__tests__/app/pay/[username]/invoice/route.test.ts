import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '@/lib/api-proxy';

vi.mock('@/lib/api-proxy', () => ({
  proxyApiRequest: vi.fn(async () => new Response('{"pr":"lnbc"}', { status: 200 })),
}));

const proxyMock = vi.mocked(proxyApiRequest);

describe('POST /pay/:username/invoice', () => {
  it('proxies the invoice body to the api', async () => {
    const { POST } = await import('@/app/pay/[username]/invoice/route');
    const request = new Request('https://21.gifts/pay/ada/invoice', { method: 'POST' });
    const res = await POST(request, { params: Promise.resolve({ username: 'a da' }) });
    expect(res.status).toBe(200);
    expect(proxyMock).toHaveBeenCalledWith(request, '/pay/a%20da/invoice');
  });
});
