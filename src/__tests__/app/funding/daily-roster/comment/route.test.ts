// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/funding/daily-roster/comment/route';
import { proxyFundingDailyRosterCommentPost } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /funding/daily-roster/comment', () => {
  it('re-exports proxyFundingDailyRosterCommentPost', async () => {
    expect(POST).toBe(proxyFundingDailyRosterCommentPost);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await POST(
          new Request('http://localhost/funding/daily-roster/comment', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/daily-roster/comment');
  });
});
