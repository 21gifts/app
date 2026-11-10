import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHeartPosts } from '@/lib/wallet/heart-context';

const HASH = 'a'.repeat(64);
const NONE = { hearts: [], repayments: [] };

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

    await expect(fetchHeartPosts('session', [HASH.toUpperCase()])).resolves.toEqual({
      hearts: [valid],
      repayments: [],
    });
    expect(fetchMock).toHaveBeenCalledWith('/me/wallet/hearts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hashes: [HASH] }),
    });
  });

  it('parses typed repayment rows and drops malformed ones', async () => {
    const giver = {
      paymentHash: HASH,
      messageId: 'note-1',
      dayIndex: 0,
      termDays: 7,
      role: 'giver',
      authorName: '',
      text: '',
      deleted: false,
    };
    const borrower = { ...giver, paymentHash: 'b'.repeat(64), role: 'borrower', termDays: null };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          hearts: [],
          repayments: [
            giver,
            borrower,
            null,
            'row',
            { ...giver, paymentHash: 1 },
            { ...giver, paymentHash: HASH.toUpperCase() },
            { ...giver, messageId: '' },
            { ...giver, messageId: 1 },
            { ...giver, dayIndex: -1 },
            { ...giver, dayIndex: 1.5 },
            { ...giver, dayIndex: '1' },
            { ...giver, termDays: 0 },
            { ...giver, termDays: 2.5 },
            { ...giver, termDays: '7' },
            { ...giver, termDays: undefined },
            { ...giver, role: 'lender' },
            { ...giver, authorName: null },
            { ...giver, text: 1 },
            { ...giver, deleted: 0 },
          ],
        }),
      ),
    );

    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual({
      hearts: [],
      repayments: [giver, borrower],
    });
  });

  it('treats a missing or malformed repayments key as no repayments', async () => {
    const heart = {
      paymentHash: HASH,
      messageId: 'message-1',
      authorName: 'Ada',
      text: 'A post',
      deleted: false,
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ hearts: [heart] }))
        .mockResolvedValueOnce(Response.json({ hearts: [heart], repayments: {} }))
        .mockResolvedValueOnce(Response.json({ hearts: [heart], repayments: null })),
    );

    for (let call = 0; call < 3; call += 1) {
      await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual({
        hearts: [heart],
        repayments: [],
      });
    }
  });

  it('returns no matches for non-success and malformed bodies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(Response.json('wrong'))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(Response.json({ hearts: {} }));
    vi.stubGlobal('fetch', fetchMock);

    for (let call = 0; call < 4; call += 1) {
      await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual(NONE);
    }
  });

  it('returns no matches when fetch or response parsing throws', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.reject(new Error('bad json')) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual(NONE);
    await expect(fetchHeartPosts('session', [HASH])).resolves.toEqual(NONE);
  });
});
