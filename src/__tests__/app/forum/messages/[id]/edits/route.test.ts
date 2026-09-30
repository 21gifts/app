// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/forum/messages/[id]/edits/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

it('forwards GET, encoded id, Bearer auth and the upstream edits URL', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ edits: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const response = await GET(
    new Request('http://localhost/forum/messages/id/edits', {
      headers: { authorization: 'Bearer token' },
    }),
    { params: Promise.resolve({ id: 'm/staff' }) },
  );
  expect(response.status).toBe(200);
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/messages/m%2Fstaff/edits');
  expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  expect(
    new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('authorization'),
  ).toBe('Bearer token');
});
