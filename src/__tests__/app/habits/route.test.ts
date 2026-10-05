// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/habits/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('habits proxy', () => {
  it('forwards GET and POST to the api /habits path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await GET(new Request('http://localhost/habits'))).status).toBe(200);
    expect((await POST(new Request('http://localhost/habits', { method: 'POST' }))).status).toBe(
      200,
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/habits');
    expect((fetchMock.mock.calls[1]?.[0] as URL).pathname).toBe('/habits');
  });
});
