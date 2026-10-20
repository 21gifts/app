import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHeartPosts } from '@/lib/wallet/heart-context';

const HASH = 'a'.repeat(64);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchHeartPosts', () => {
  it('posts lowercase hashes with the session and keeps only valid heart rows', async () => {
    const valid = {
      paymentHash: HASH,
      messageId: 'message-1',
      authorName: 'Ada',
      text: 'A post',
      deleted: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        hearts: [
          valid,
          null,
          'row',
          { ...valid, paymentHash: 1 },
          { ...valid, paymentHash: 'g'.repeat(64) },
          { ...valid, messageId: 1 },
          { ...valid, messageId: '' },
          { ...valid, authorName: 1 },
          { ...valid, text: 1 },
          { ...valid, deleted: 'no' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHeartPosts('session', [HASH.toUpperCase()])).resolves.toEqual([valid]);
    expect(fetchMock).toHaveBeenCalledWith('/me/wallet/hearts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hashes: [HASH] }),
    });
  });

  it('returns an empty array for non-success and malformed bodies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(Response.json('wrong'))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(Response.json({ hearts: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual([]);
    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual([]);
    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual([]);
    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual([]);
  });

  it('returns an empty array when fetch or response parsing throws', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.reject(new Error('bad json')) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual([]);
    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual([]);
  });
});
