import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMemberHabits, postMemberHabit } from '@/lib/member-habits';

const LOAD_ERROR = 'Could not load the habit tracker. Please try again.';
const SAVE_ERROR = 'Could not save the habit tracker. Please try again.';

const list = {
  reviewWeek: { start: '2026-09-28' },
  habits: [
    {
      id: 'h1',
      accountId: 'acc',
      ownerName: 'Ada',
      role: 'basis',
      name: 'Walk',
      description: '',
      cadence: 'daily',
      timeZone: 'Asia/Manila',
      firstPeriod: '2026-10-01',
      lastPeriod: null,
      periods: [],
      comments: [],
    },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMemberHabits', () => {
  it('loads without a bearer when signed out or the token is blank', async () => {
    const fetchMock = vi.fn().mockImplementation(() => json(list));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchMemberHabits(null)).habits[0]?.name).toBe('Walk');
    expect((await fetchMemberHabits('')).habits).toHaveLength(1);
    const first = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const second = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(first.headers).toEqual({});
    expect(second.headers).toEqual({});
  });

  it('sends the bearer and rejects a failed response, bad json, and a bad body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(list))
      .mockResolvedValueOnce(json({ error: 'nope' }, 500))
      .mockResolvedValueOnce(new Response('nope', { status: 200 }))
      .mockResolvedValueOnce(json({ habits: [] }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchMemberHabits('tok')).habits[0]?.id).toBe('h1');
    const authed = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(authed.headers).toEqual({ Authorization: 'Bearer tok' });
    await expect(fetchMemberHabits('tok')).rejects.toThrow(LOAD_ERROR);
    await expect(fetchMemberHabits('tok')).rejects.toThrow(LOAD_ERROR);
    await expect(fetchMemberHabits('tok')).rejects.toThrow(LOAD_ERROR);
  });
});

describe('postMemberHabit', () => {
  it('returns json, sends the time zone only when asked, and surfaces api errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: true, id: 'h1' }))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(new Response('nope', { status: 200 }))
      .mockResolvedValueOnce(new Response('nope', { status: 400 }))
      .mockResolvedValueOnce(
        json({ error: "The author's wallet cannot receive this Bitcoin payment" }, 409),
      )
      .mockResolvedValueOnce(json({ error: 1 }, 400))
      .mockResolvedValueOnce(json(null, 400))
      .mockResolvedValueOnce(json({}, 400));
    vi.stubGlobal('fetch', fetchMock);
    expect(await postMemberHabit('tok', { action: 'add' }, false)).toEqual({ ok: true, id: 'h1' });
    const plain = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(plain.headers).toEqual({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
    expect(await postMemberHabit('tok', { action: 'add' }, true)).toEqual({ ok: true });
    const zoned = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(zoned.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Time-Zone': expect.any(String),
    });
    await expect(postMemberHabit('tok', { action: 'add' }, false)).rejects.toThrow(SAVE_ERROR);
    await expect(postMemberHabit('tok', { action: 'add' }, false)).rejects.toThrow(SAVE_ERROR);
    await expect(postMemberHabit('tok', { action: 'add' }, false)).rejects.toThrow(
      "The author's wallet cannot receive this Bitcoin payment",
    );
    await expect(postMemberHabit('tok', { action: 'add' }, false)).rejects.toThrow(SAVE_ERROR);
    await expect(postMemberHabit('tok', { action: 'add' }, false)).rejects.toThrow(SAVE_ERROR);
    await expect(postMemberHabit('tok', { action: 'add' }, false)).rejects.toThrow(SAVE_ERROR);
  });
});
