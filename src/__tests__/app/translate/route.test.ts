// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/translate-upstream', () => ({
  proxyTranslateGet: vi.fn(() => Response.json({ available: true })),
  proxyTranslatePost: vi.fn(() => Promise.resolve(Response.json({ translatedText: 'Hello' }))),
}));

import { GET, POST } from '@/app/translate/route';
import { proxyTranslateGet, proxyTranslatePost } from '@/lib/translate-upstream';

afterEach(() => {
  vi.clearAllMocks();
});

describe('/translate route', () => {
  it('delegates GET to proxyTranslateGet', async () => {
    const response = GET();
    expect(proxyTranslateGet).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ available: true });
  });

  it('delegates POST to proxyTranslatePost with the incoming request', async () => {
    const request = new Request('http://localhost/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hallo zusammen', target: 'en' }),
    });
    const response = await POST(request);
    expect(proxyTranslatePost).toHaveBeenCalledWith(request);
    await expect(response.json()).resolves.toEqual({ translatedText: 'Hello' });
  });
});
