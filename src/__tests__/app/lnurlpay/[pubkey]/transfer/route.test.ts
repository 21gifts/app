// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/lnurlpay/[pubkey]/transfer/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /lnurlpay/02ab/transfer', () => {
  it('forwards to the api path with the encoded key', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      new Request('http://localhost/lnurlpay/02ab/transfer', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ pubkey: '02ab' }) },
    );
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/lnurlpay/02ab/transfer');
    await POST(
      new Request('http://localhost/lnurlpay/x/transfer', { method: 'POST', body: '{}' }),
      {
        params: Promise.resolve({ pubkey: 'a/b' }),
      },
    );
    expect((fetchMock.mock.calls[1]?.[0] as URL).pathname).toBe('/lnurlpay/a%2Fb/transfer');
  });
});
