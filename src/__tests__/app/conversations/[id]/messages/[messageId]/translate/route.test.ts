// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-proxies', () => ({
  proxyTranslateConversationMessagePost: vi.fn(() =>
    Promise.resolve(Response.json({ translatedText: 'Hello', cached: false })),
  ),
}));

import { POST } from '@/app/conversations/[id]/messages/[messageId]/translate/route';
import { proxyTranslateConversationMessagePost } from '@/lib/api-proxies';

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /conversations/[id]/messages/[messageId]/translate', () => {
  it('delegates to proxyTranslateConversationMessagePost', async () => {
    const request = new Request('http://localhost/conversations/c1/messages/m1/translate', {
      method: 'POST',
      body: JSON.stringify({ target: 'en' }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: 'c1', messageId: 'm1' }),
    });
    expect(proxyTranslateConversationMessagePost).toHaveBeenCalledWith(request, 'c1', 'm1');
    await expect(response.json()).resolves.toEqual({ translatedText: 'Hello', cached: false });
  });
});
