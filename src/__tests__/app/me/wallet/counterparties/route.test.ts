// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/me/wallet/counterparties/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

it('forwards the sender lookup', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  expect(
    (
      await POST(
        new Request('http://localhost/me/wallet/counterparties', { method: 'POST', body: '{}' }),
      )
    ).status,
  ).toBe(200);
  expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/wallet/counterparties');
});
