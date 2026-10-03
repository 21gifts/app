// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/habits/data/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/habits/data', () => {
  it('forwards a week read to the habit-tracker api', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(new Request('http://localhost/habits/data?week=2026-09-28'));
    expect(response.status).toBe(200);
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/habit-tracker');
    expect(url.search).toBe('?week=2026-09-28');
  });

  it('forwards a mutation to the habit-tracker api', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      new Request('http://localhost/habits/data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'add', text: 'Read' }),
      }),
    );
    expect(response.status).toBe(200);
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(url.pathname).toBe('/habit-tracker');
    expect(init.method).toBe('POST');
  });
});
