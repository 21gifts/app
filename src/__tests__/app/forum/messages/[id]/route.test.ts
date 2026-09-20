// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { DELETE, GET } from '@/app/forum/messages/[id]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});
it('forwards GET, encoded id and Bearer auth', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 'a/b' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const response = await GET(
    new Request('http://localhost/forum/messages/id', {
      headers: { authorization: 'Bearer token' },
    }),
    { params: Promise.resolve({ id: 'a/b' }) },
  );
  expect(response.status).toBe(200);
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/messages/a%2Fb');
  expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  expect(
    new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('authorization'),
  ).toBe('Bearer token');
});

it('forwards deletion, encoded id, Bearer auth and the empty response', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  const response = await DELETE(
    new Request('http://localhost/forum/messages/id', {
      method: 'DELETE',
      headers: { authorization: 'Bearer token' },
    }),
    { params: Promise.resolve({ id: 'a/b' }) },
  );
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/messages/a%2Fb');
  expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
  expect(
    new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('authorization'),
  ).toBe('Bearer token');
});
