// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/conversations/[id]/messages/[messageId]/photo/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/conversations/[id]/messages/[messageId]/photo', () => {
  it('exports a GET proxy that forwards both ids', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/conversations/c1/messages/m1/photo'), {
          params: Promise.resolve({ id: 'c1', messageId: 'm1' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/conversations/c1/messages/m1/photo',
    );
  });
});
