// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/messages/[id]/[file]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/messages/[id]/[file]', () => {
  it('proxies video.mp4 to the api', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/messages/m1/video.mp4'), {
          params: Promise.resolve({ id: 'm1', file: 'video.mp4' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/video.mp4');
  });

  it('proxies video.webm and video.mov', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/messages/m1/video.webm'), {
          params: Promise.resolve({ id: 'm1', file: 'video.webm' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/video.webm');
    expect(
      (
        await GET(new Request('http://localhost/messages/m1/video.mov'), {
          params: Promise.resolve({ id: 'm1', file: 'video.mov' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[1]?.[0] as URL).pathname).toBe('/messages/m1/video.mov');
  });

  it('returns 404 without fetching for unknown file names', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/messages/m1/nope'), {
          params: Promise.resolve({ id: 'm1', file: 'nope' }),
        })
      ).status,
    ).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
