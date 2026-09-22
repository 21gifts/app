// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-proxies', () => ({
  proxyMessagesPlacesGet: vi.fn(() => Response.json({ places: [] })),
}));

import { GET } from '@/app/forum/messages/places/route';
import { proxyMessagesPlacesGet } from '@/lib/api-proxies';

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /forum/messages/places', () => {
  it('delegates to proxyMessagesPlacesGet', async () => {
    const request = new Request('http://localhost/forum/messages/places');
    const response = await GET(request);
    expect(proxyMessagesPlacesGet).toHaveBeenCalledWith(request);
    await expect(response.json()).resolves.toEqual({ places: [] });
  });
});
