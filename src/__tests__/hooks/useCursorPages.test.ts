import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCursorPages } from '@/hooks/useCursorPages';

type Page = { rows: string[]; nextCursor: string | null };

/** Captured IntersectionObserver callbacks, newest last. */
let observers: { callback: IntersectionObserverCallback; disconnect: () => void }[] = [];

class FakeObserver {
  public constructor(callback: IntersectionObserverCallback) {
    observers.push({ callback, disconnect: () => undefined });
  }
  public observe(): void {}
  public disconnect(): void {}
}

/** Fires the newest observer as if the end of the list came into view. */
function scrollToEnd(visible = true): void {
  const observer = observers[observers.length - 1];
  observer?.callback(
    [{ isIntersecting: visible } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

/**
 * Renders the hook and attaches a sentinel node so the observer effect arms.
 */
function renderPages(
  load: ((before: string | null) => Promise<Page | null>) | null,
  key = 'k1',
): ReturnType<typeof renderHook<ReturnType<typeof useCursorPages<Page>>, { key: string }>> {
  return renderHook(
    ({ key: listKey }) => {
      const result = useCursorPages<Page>(load, listKey);
      result.sentinelRef.current = document.createElement('li');
      return result;
    },
    { initialProps: { key } },
  );
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCursorPages', () => {
  it('loads the first page, then the next page when the end is in view', async () => {
    const load = vi.fn(async (before: string | null): Promise<Page> =>
      before === null ? { rows: ['a'], nextCursor: 'c1' } : { rows: ['b'], nextCursor: null },
    );
    const { result, rerender } = renderPages(load);
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMore).toBe(true);
    rerender({ key: 'k1' });
    act(() => scrollToEnd(false));
    expect(load).toHaveBeenCalledTimes(1);
    act(() => {
      scrollToEnd();
      scrollToEnd();
    });
    await waitFor(() => expect(result.current.pages).toHaveLength(2));
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith('c1');
    expect(result.current.hasMore).toBe(false);
  });

  it('reports forbidden when the api refuses the role', async () => {
    const { result } = renderPages(() => Promise.resolve(null));
    await waitFor(() => expect(result.current.status).toBe('forbidden'));
  });

  it('retries the first page after an error', async () => {
    const load = vi
      .fn<(before: string | null) => Promise<Page | null>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ rows: ['a'], nextCursor: null });
    const { result } = renderPages(load);
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(load).toHaveBeenLastCalledWith(null);
    expect(result.current.pages).toEqual([{ rows: ['a'], nextCursor: null }]);
  });

  it('keeps loaded pages when the next page fails, and retries that page', async () => {
    const load = vi
      .fn<(before: string | null) => Promise<Page | null>>()
      .mockResolvedValueOnce({ rows: ['a'], nextCursor: 'c1' })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ rows: ['b'], nextCursor: null });
    const { result, rerender } = renderPages(load);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ key: 'k1' });
    act(() => scrollToEnd());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.pages).toHaveLength(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(load).toHaveBeenLastCalledWith('c1');
    expect(result.current.pages).toHaveLength(2);
  });

  it('ignores retry and load more while a page is loading', async () => {
    let resolve: (page: Page) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<Page>((done) => {
          resolve = done;
        }),
    );
    const { result } = renderPages(load);
    act(() => result.current.retry());
    act(() => scrollToEnd());
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ rows: [], nextCursor: null });
      await Promise.resolve();
    });
    expect(result.current.status).toBe('ready');
  });

  it('starts again on a new key and drops answers for the old key', async () => {
    const answers: Record<string, (page: Page) => void> = {};
    const fail: Record<string, (error: Error) => void> = {};
    let call = 0;
    const load = vi.fn(
      () =>
        new Promise<Page>((done, reject) => {
          call += 1;
          answers[String(call)] = done;
          fail[String(call)] = reject;
        }),
    );
    const { result, rerender } = renderPages(load, 'k1');
    rerender({ key: 'k2' });
    await act(async () => {
      answers['1']?.({ rows: ['old'], nextCursor: null });
      fail['1']?.(new Error('late'));
      answers['2']?.({ rows: ['new'], nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.pages).toEqual([{ rows: ['new'], nextCursor: null }]);
  });

  it('drops a forbidden answer and a failure for an old key', async () => {
    const settle: ((value: 'null' | 'fail' | Page) => void)[] = [];
    const load = vi.fn(
      () =>
        new Promise<Page | null>((done, reject) => {
          settle.push((value) => {
            if (value === 'null') {
              done(null);
            } else if (value === 'fail') {
              reject(new Error('late'));
            } else {
              done(value);
            }
          });
        }),
    );
    const { result, rerender } = renderPages(load, 'k1');
    rerender({ key: 'k2' });
    rerender({ key: 'k3' });
    await act(async () => {
      settle[0]?.('null');
      settle[1]?.('fail');
      settle[2]?.({ rows: ['k3'], nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.pages[0]?.rows).toEqual(['k3']);
  });

  it('sends nothing while load is null, even on retry', () => {
    const { result } = renderPages(null);
    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');
  });

  it('does not watch the end without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const load = vi.fn(async (): Promise<Page> => ({ rows: ['a'], nextCursor: 'c1' }));
    const { result } = renderPages(load);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(observers).toHaveLength(0);
  });
});
