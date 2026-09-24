// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-proxies', () => ({
  proxyTranslateAvailableGet: vi.fn(() => Promise.resolve(Response.json({ available: true }))),
  proxyTranslateNotePost: vi.fn(() =>
    Promise.resolve(Response.json({ translatedText: 'Hello', cached: true })),
  ),
}));

import { GET, POST } from '@/app/translate/route';
import { proxyTranslateAvailableGet, proxyTranslateNotePost } from '@/lib/api-proxies';

afterEach(() => {
  vi.clearAllMocks();
});

describe('/translate route', () => {
  it('delegates GET to proxyTranslateAvailableGet', async () => {
    const request = new Request('http://localhost/translate');
    const response = await GET(request);
    expect(proxyTranslateAvailableGet).toHaveBeenCalledWith(request);
    await expect(response.json()).resolves.toEqual({ available: true });
  });

  it('delegates POST to proxyTranslateNotePost with the incoming request', async () => {
    const request = new Request('http://localhost/translate', {
      method: 'POST',
      body: JSON.stringify({
        messageId: '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a',
        target: 'en',
      }),
    });
    const response = await POST(request);
    expect(proxyTranslateNotePost).toHaveBeenCalledWith(request);
    await expect(response.json()).resolves.toEqual({ translatedText: 'Hello', cached: true });
  });
});
