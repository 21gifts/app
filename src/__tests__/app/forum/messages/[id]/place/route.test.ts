// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { PATCH } from '@/app/forum/messages/[id]/place/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

it('forwards PATCH, encoded id, Bearer auth and the upstream place URL', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 'a/b' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const response = await PATCH(
    new Request('http://localhost/forum/messages/id/place', {
      method: 'PATCH',
      headers: { authorization: 'Bearer token' },
    }),
    { params: Promise.resolve({ id: 'a/b' }) },
  );
  expect(response.status).toBe(200);
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/messages/a%2Fb/place');
  expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('PATCH');
  expect(
    new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('authorization'),
  ).toBe('Bearer token');
});
