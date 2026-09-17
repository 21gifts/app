// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/conversations/moderator-group/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/conversations/moderator-group', () => {
  it('exports a GET proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (await GET(new Request('http://localhost/conversations/moderator-group'))).status,
    ).toBe(200);
  });
});
