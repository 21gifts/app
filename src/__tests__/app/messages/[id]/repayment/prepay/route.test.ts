// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/messages/[id]/repayment/prepay/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /messages/[id]/repayment/prepay', () => {
  it('is the prepay repayment proxy and forwards its JSON body', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      new Request('http://localhost/messages/a%2Fb/repayment/prepay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: '1000' }),
      }),
      { params: Promise.resolve({ id: 'a/b' }) },
    );
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/a%2Fb/repayment/prepay');
    expect(
      new TextDecoder().decode((fetchMock.mock.calls[0]?.[1] as RequestInit).body as ArrayBuffer),
    ).toBe('{"amount":"1000"}');
  });
});
