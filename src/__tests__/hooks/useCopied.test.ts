import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopied } from '@/hooks/useCopied';

const writeText = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('useCopied', () => {
  it('says copied for two seconds, counted again from each copy', async () => {
    const { result } = renderHook(() => useCopied());
    expect(result.current.copied).toBe(false);
    let done = false;
    await act(async () => {
      done = await result.current.copy('ada@21.gifts');
    });
    expect(done).toBe(true);
    expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.copy('ada@21.gifts');
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });

  it('changes nothing when the clipboard refuses or is missing', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useCopied());
    let done = true;
    await act(async () => {
      done = await result.current.copy('x');
    });
    expect(done).toBe(false);
    expect(result.current.copied).toBe(false);
    Reflect.deleteProperty(navigator, 'clipboard');
    await act(async () => {
      await result.current.copy('x');
    });
    expect(result.current.copied).toBe(false);
  });
});
