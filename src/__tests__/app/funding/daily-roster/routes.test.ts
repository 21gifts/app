// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as postComment } from '@/app/funding/daily-roster/comment/route';
import { POST as postPayments } from '@/app/funding/daily-roster/payments/route';
import { POST as postDelete } from '@/app/funding/daily-roster/recipients/delete/route';
import { GET as getRoster } from '@/app/funding/daily-roster/route';
import { POST as postAdd } from '@/app/funding/daily-roster/recipients/route';
import { POST as postUpdate } from '@/app/funding/daily-roster/recipients/update/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('daily roster app routes', () => {
  it('forwards each roster path to the api', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const calls: Array<[typeof getRoster, string, string]> = [
      [getRoster, 'GET', '/funding/daily-roster'],
      [postComment, 'POST', '/funding/daily-roster/comment'],
      [postPayments, 'POST', '/funding/daily-roster/payments'],
      [postAdd, 'POST', '/funding/daily-roster/recipients'],
      [postUpdate, 'POST', '/funding/daily-roster/recipients/update'],
      [postDelete, 'POST', '/funding/daily-roster/recipients/delete'],
    ];
    for (const [handler, method, path] of calls) {
      fetchMock.mockClear();
      const response = await handler(
        new Request(`http://localhost${path}`, {
          method,
          body: method === 'POST' ? '{}' : null,
        }),
      );
      expect(response.status).toBe(200);
      expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(path);
    }
  });
});
