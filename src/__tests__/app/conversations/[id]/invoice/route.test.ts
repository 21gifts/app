// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/conversations/[id]/invoice/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/conversations/[id]/invoice', () => {
  it('exports a POST proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await POST(
          new Request('http://localhost/conversations/c1/invoice', {
            method: 'POST',
            body: '{}',
          }),
          {
            params: Promise.resolve({ id: 'c1' }),
          },
        )
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/conversations/c1/invoice');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });
});
