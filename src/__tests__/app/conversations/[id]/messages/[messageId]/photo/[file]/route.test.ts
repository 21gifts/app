// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/conversations/[id]/messages/[messageId]/photo/[file]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/conversations/[id]/messages/[messageId]/photo/[file]', () => {
  it('proxies 1.jpg to the api extra-still path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/conversations/c1/messages/m1/photo/1.jpg'), {
          params: Promise.resolve({ id: 'c1', messageId: 'm1', file: '1.jpg' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/conversations/c1/messages/m1/photo/1.jpg',
    );
  });

  it('returns 404 for an unsupported filename', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/conversations/c1/messages/m1/photo/0.jpg'), {
          params: Promise.resolve({ id: 'c1', messageId: 'm1', file: '0.jpg' }),
        })
      ).status,
    ).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
