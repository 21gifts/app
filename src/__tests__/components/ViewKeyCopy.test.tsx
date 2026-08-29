import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewKeyCopy } from '@/components/ViewKeyCopy';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const VIEW_KEY = 'a'.repeat(64);
const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;

function stubExecCommand(impl: (commandId: string) => boolean): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: fn,
  });
  return fn;
}

function expectIdleIcon(button: HTMLElement): void {
  expect(button.getAttribute('data-copied')).toBeNull();
  const svg = button.querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg?.getAttribute('class') ?? '').toContain('lucide-link2');
}

function expectCopiedIcon(button: HTMLElement): void {
  expect(button.getAttribute('data-copied')).toBe('true');
  const svg = button.querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg?.getAttribute('class') ?? '').toContain('lucide-check');
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.assign(navigator, { clipboard: originalClipboard });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: originalExecCommand,
  });
});

describe('ViewKeyCopy', () => {
  it('copies the absolute view URL and flashes, then resets', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);

    const button = screen.getByRole('button', { name: 'Copy view-key link' });
    expectIdleIcon(button);
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/view/${VIEW_KEY}`);
    expectCopiedIcon(button);

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expectIdleIcon(button);
  });

  it('keeps the aria-label unchanged while data-copied is true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Copy view-key link' });
      expectCopiedIcon(button);
      expect(button.textContent).not.toContain('Copied');
    });
  });

  it('falls back to execCommand when clipboard write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    const exec = stubExecCommand(() => true);
    renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    await waitFor(() => {
      expectCopiedIcon(screen.getByRole('button', { name: 'Copy view-key link' }));
    });
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when clipboard is missing', async () => {
    Object.assign(navigator, { clipboard: undefined });
    const exec = stubExecCommand(() => true);
    renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    await waitFor(() => {
      expectCopiedIcon(screen.getByRole('button', { name: 'Copy view-key link' }));
    });
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('stays idle and logs when clipboard and fallback both fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expectIdleIcon(screen.getByRole('button', { name: 'Copy view-key link' }));
  });

  it('stays idle when execCommand throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => {
      throw new Error('no exec');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expectIdleIcon(screen.getByRole('button', { name: 'Copy view-key link' }));
  });

  it('unmounts without a pending timer', () => {
    const { unmount } = renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    unmount();
  });

  it('ignores a clipboard write that resolves after unmount', async () => {
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    unmount();
    await act(async () => {
      resolveWrite?.();
      await Promise.resolve();
    });
  });

  it('ignores a clipboard reject that settles after unmount', async () => {
    let rejectWrite: ((error: Error) => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectWrite = reject;
        }),
    );
    Object.assign(navigator, { clipboard: { writeText } });
    const exec = stubExecCommand(() => true);
    const { unmount } = renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    unmount();
    await act(async () => {
      rejectWrite?.(new Error('denied'));
      await Promise.resolve();
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it('clears a pending reset timer on unmount', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy view-key link' }));
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
  });

  it('restarts the Copied timer on a second click', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<ViewKeyCopy viewKey={VIEW_KEY} />);
    const button = screen.getByRole('button', { name: 'Copy view-key link' });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expectCopiedIcon(button);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expectIdleIcon(button);
  });
});
