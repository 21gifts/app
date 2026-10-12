import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeartContext } from '@/hooks/useHeartContext';
import { useActiveSession } from '@/hooks/useActiveSession';
import { fetchHeartPosts, type HeartPost } from '@/lib/wallet/heart-context';
import {
  HEART_VISUAL_AUTHOR,
  HEART_VISUAL_HASH,
  HEART_VISUAL_MESSAGE_ID,
  HEART_VISUAL_TEXT,
} from '@/lib/wallet/payment-fixtures';

vi.mock('@/hooks/useActiveSession', () => ({ useActiveSession: vi.fn() }));
vi.mock('@/lib/wallet/heart-context', () => ({ fetchHeartPosts: vi.fn() }));

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function heart(paymentHash: string, messageId = 'message-1'): HeartPost {
  return { paymentHash, messageId, authorName: 'Ada', text: 'Post', deleted: false };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  vi.mocked(useActiveSession).mockReset().mockReturnValue('session');
  vi.mocked(fetchHeartPosts).mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useHeartContext', () => {
  it.each(['heart-payment', 'history-heart'])(
    '%s injects the visual heart without a fetch',
    (pin) => {
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
      window.history.replaceState({}, '', `/wallet?visual=${pin}`);
      const { result } = renderHook(() => useHeartContext([HEART_VISUAL_HASH]));
      expect(result.current.byHash.get(HEART_VISUAL_HASH)).toEqual({
        paymentHash: HEART_VISUAL_HASH,
        messageId: HEART_VISUAL_MESSAGE_ID,
        authorName: HEART_VISUAL_AUTHOR,
        text: HEART_VISUAL_TEXT,
        deleted: false,
      });
      expect([...result.current.pending]).toEqual([]);
      expect(fetchHeartPosts).not.toHaveBeenCalled();
    },
  );

  it.each(['heart-payment', 'history-heart'])(
    '%s does not inject the visual heart outside a Playwright build',
    async (pin) => {
      window.history.replaceState({}, '', `/wallet?visual=${pin}`);
      vi.mocked(fetchHeartPosts).mockResolvedValue([]);
      const { result } = renderHook(() => useHeartContext([HEART_VISUAL_HASH]));
      expect(result.current.byHash.has(HEART_VISUAL_HASH)).toBe(false);
      await waitFor(() => expect(result.current.pending.size).toBe(0));
      expect(fetchHeartPosts).toHaveBeenCalledWith('session', [HEART_VISUAL_HASH]);
    },
  );

  it('does not fetch without a session or without hashes', async () => {
    vi.mocked(useActiveSession).mockReturnValue(null);
    const signedOut = renderHook(() => useHeartContext([HASH_A]));
    expect([...signedOut.result.current.byHash]).toEqual([]);
    expect([...signedOut.result.current.pending]).toEqual([]);
    signedOut.unmount();

    vi.mocked(useActiveSession).mockReturnValue('session');
    const empty = renderHook(() => useHeartContext([]));
    await act(async () => undefined);
    expect([...empty.result.current.byHash]).toEqual([]);
    expect([...empty.result.current.pending]).toEqual([]);
    expect(fetchHeartPosts).not.toHaveBeenCalled();
  });

  it('uniques lowercase hashes and loads sequential chunks of 32', async () => {
    const hashes = Array.from({ length: 34 }, (_, index) =>
      index.toString(16).padStart(64, '0').toUpperCase(),
    );
    const lowercase = hashes.map((hash) => hash.toLowerCase());
    let resolveFirst!: (posts: HeartPost[]) => void;
    let resolveSecond!: (posts: HeartPost[]) => void;
    vi.mocked(fetchHeartPosts)
      .mockReturnValueOnce(
        new Promise<HeartPost[]>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<HeartPost[]>((resolve) => {
          resolveSecond = resolve;
        }),
      );

    const { result } = renderHook(() => useHeartContext([hashes[0] as string, ...hashes]));
    expect(result.current.pending.size).toBe(34);
    await waitFor(() => expect(fetchHeartPosts).toHaveBeenCalledTimes(1));
    expect(fetchHeartPosts).toHaveBeenNthCalledWith(1, 'session', lowercase.slice(0, 32));

    await act(async () => {
      resolveFirst([heart(lowercase[0] as string), heart(HASH_B)]);
    });
    expect(result.current.byHash.get(lowercase[0] as string)).toEqual(
      heart(lowercase[0] as string),
    );
    expect(result.current.pending.size).toBe(2);
    expect(fetchHeartPosts).toHaveBeenNthCalledWith(2, 'session', lowercase.slice(32));

    await act(async () => {
      resolveSecond([]);
    });
    expect(result.current.pending.size).toBe(0);
  });

  it('keeps resolved hashes, requests only a new hash, and does not retry misses', async () => {
    vi.mocked(fetchHeartPosts)
      .mockResolvedValueOnce([heart(HASH_A)])
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(
      ({ hashes }: { hashes: string[] }) => useHeartContext(hashes),
      { initialProps: { hashes: [HASH_A.toUpperCase()] } },
    );
    await waitFor(() => expect(result.current.byHash.has(HASH_A)).toBe(true));

    rerender({ hashes: [HASH_A] });
    expect(fetchHeartPosts).toHaveBeenCalledTimes(1);
    rerender({ hashes: [HASH_A, HASH_B] });
    expect(result.current.byHash.has(HASH_A)).toBe(true);
    expect(result.current.pending.has(HASH_B)).toBe(true);
    await waitFor(() => expect(result.current.pending.size).toBe(0));
    expect(fetchHeartPosts).toHaveBeenNthCalledWith(2, 'session', [HASH_B]);

    rerender({ hashes: [HASH_A, HASH_B] });
    await act(async () => undefined);
    expect(fetchHeartPosts).toHaveBeenCalledTimes(2);
    rerender({ hashes: [HASH_B, HASH_A] });
    expect(result.current.byHash.has(HASH_A)).toBe(true);
    expect(result.current.byHash.has(HASH_B)).toBe(false);
    expect(result.current.pending.size).toBe(0);
    expect(fetchHeartPosts).toHaveBeenCalledTimes(2);
  });

  it('clears pending after a rejected fetch without throwing or looping', async () => {
    vi.mocked(fetchHeartPosts).mockRejectedValue(new Error('offline'));
    const { result, rerender } = renderHook(() => useHeartContext([HASH_A]));
    await waitFor(() => expect(result.current.pending.size).toBe(0));
    expect([...result.current.byHash]).toEqual([]);
    rerender();
    await act(async () => undefined);
    expect(fetchHeartPosts).toHaveBeenCalledTimes(1);
  });

  it('ignores a response for an older hash set', async () => {
    let resolveOld!: (posts: HeartPost[]) => void;
    vi.mocked(fetchHeartPosts)
      .mockReturnValueOnce(
        new Promise<HeartPost[]>((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce([heart(HASH_B, 'new-message')]);
    const { result, rerender } = renderHook(
      ({ hash }: { hash: string }) => useHeartContext([hash]),
      { initialProps: { hash: HASH_A } },
    );
    await waitFor(() => expect(fetchHeartPosts).toHaveBeenCalledTimes(1));
    rerender({ hash: HASH_B });
    await waitFor(() => expect(result.current.byHash.get(HASH_B)?.messageId).toBe('new-message'));

    await act(async () => {
      resolveOld([heart(HASH_A, 'old-message')]);
    });
    expect(result.current.byHash.has(HASH_A)).toBe(false);
    expect(result.current.byHash.get(HASH_B)?.messageId).toBe('new-message');
  });

  it('clears cached context when the active session changes', async () => {
    vi.mocked(fetchHeartPosts)
      .mockResolvedValueOnce([heart(HASH_A)])
      .mockResolvedValueOnce([]);
    vi.mocked(useActiveSession).mockReturnValue('first');
    const { result, rerender } = renderHook(() => useHeartContext([HASH_A]));
    await waitFor(() => expect(result.current.byHash.has(HASH_A)).toBe(true));

    vi.mocked(useActiveSession).mockReturnValue('second');
    rerender();
    expect(result.current.byHash.has(HASH_A)).toBe(false);
    expect(result.current.pending.has(HASH_A)).toBe(true);
    await waitFor(() => expect(result.current.pending.size).toBe(0));
    expect(fetchHeartPosts).toHaveBeenNthCalledWith(2, 'second', [HASH_A]);
  });
});
