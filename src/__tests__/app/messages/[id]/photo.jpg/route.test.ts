// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/messages/[id]/photo.jpg/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/messages/[id]/photo.jpg', () => {
  it('proxies GET to photo.jpg without Authorization and keeps the query', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(
          new Request('http://localhost/messages/m1/photo.jpg?v=1', {
            headers: { Authorization: 'Bearer secret' },
          }),
          {
            params: Promise.resolve({ id: 'm1' }),
          },
        )
      ).status,
    ).toBe(200);
    const destination = fetchMock.mock.calls[0]?.[0] as URL;
    expect(destination.pathname).toBe('/messages/m1/photo.jpg');
    expect(destination.pathname).not.toBe('/messages/m1/photo');
    expect(destination.search).toBe('?v=1');
    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get('authorization')).toBeNull();
  });

  it('encodes the id in the upstream path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/messages/a%2Fb/photo.jpg'), {
          params: Promise.resolve({ id: 'a/b' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/a%2Fb/photo.jpg');
  });
});
