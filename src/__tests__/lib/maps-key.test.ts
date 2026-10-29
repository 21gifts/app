import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMapsKey } from '@/lib/maps-key';

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMapsKey', () => {
  it('asks same-origin /maps/key and returns the trimmed key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ key: ' browser-key ' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMapsKey()).resolves.toBe('browser-key');
    expect(fetchMock).toHaveBeenCalledWith('/maps/key');
  });

  it('returns null for every missing, non-string, or blank key shape', async () => {
    for (const body of [21, null, {}, { key: null }, { key: 7 }, { key: '   ' }]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
      await expect(fetchMapsKey()).resolves.toBeNull();
    }
  });

  it('returns null instead of rejecting on a network or JSON failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(fetchMapsKey()).resolves.toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.reject(new SyntaxError('bad json')),
      } as unknown as Response),
    );
    await expect(fetchMapsKey()).resolves.toBeNull();
  });
});
