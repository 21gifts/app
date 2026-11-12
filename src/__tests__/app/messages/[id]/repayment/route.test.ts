// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/messages/[id]/repayment/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/messages/[id]/repayment', () => {
  it('exports GET and POST proxies', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const got = await GET(new Request('http://localhost/messages/m1/repayment'), {
      params: Promise.resolve({ id: 'm1' }),
    });
    expect(got.status).toBe(200);
  });

  it('forwards POST without adding a body', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(
      new Request('http://localhost/messages/m1/repayment', { method: 'POST' }),
      { params: Promise.resolve({ id: 'm1' }) },
    );
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/repayment');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined();
  });

  it('forwards an optional JSON amount body unchanged', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(
      new Request('http://localhost/messages/a%2Fb/repayment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: '1000' }),
      }),
      { params: Promise.resolve({ id: 'a/b' }) },
    );
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/a%2Fb/repayment');
    expect(
      new TextDecoder().decode((fetchMock.mock.calls[0]?.[1] as RequestInit).body as ArrayBuffer),
    ).toBe('{"amount":"1000"}');
  });
});
