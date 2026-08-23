import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';

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
  window.location.hash = '';
});

describe('HandbookCopyLink', () => {
  it('copies the absolute hash URL and flashes Copied, then resets', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<HandbookCopyLink targetId="screens" label="Screens" />);

    const button = screen.getByRole('button', { name: 'Copy link to Screens' });
    expect(button.textContent).toBe('Copy link');
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}${window.location.pathname}#screens`,
    );
    expect(button.textContent).toBe('Copied');
    expect(button.getAttribute('data-copied')).toBe('true');
    expect(window.location.hash).toBe('#screens');

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(button.textContent).toBe('Copy link');
    expect(button.getAttribute('data-copied')).toBeNull();
  });

  it('keeps the aria-label while the visible text is Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<HandbookCopyLink targetId="handbook" label="Handbook" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Handbook' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to Handbook' }).textContent).toBe(
        'Copied',
      );
    });
  });

  it('does not rewrite the hash when it already matches', async () => {
    window.location.hash = '#screens';
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<HandbookCopyLink targetId="screens" label="Screens" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Screens' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(window.location.hash).toBe('#screens');
  });

  it('falls back to execCommand when clipboard write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    const exec = stubExecCommand(() => true);
    render(<HandbookCopyLink targetId="functions" label="Functions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Functions' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to Functions' }).textContent).toBe(
        'Copied',
      );
    });
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when clipboard is missing', async () => {
    Object.assign(navigator, { clipboard: undefined });
    const exec = stubExecCommand(() => true);
    render(<HandbookCopyLink targetId="readme" label="Overview" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Overview' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to Overview' }).textContent).toBe(
        'Copied',
      );
    });
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('stays idle and logs when clipboard and fallback both fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<HandbookCopyLink targetId="endpoints" label="Endpoints" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Endpoints' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', { name: 'Copy link to Endpoints' }).textContent).toBe(
      'Copy link',
    );
  });

  it('stays idle when execCommand throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => {
      throw new Error('no exec');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<HandbookCopyLink targetId="x" label="X" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to X' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', { name: 'Copy link to X' }).textContent).toBe('Copy link');
  });

  it('unmounts without a pending timer', () => {
    const { unmount } = render(<HandbookCopyLink targetId="handbook" label="Handbook" />);
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
    window.location.hash = '';
    const { unmount } = render(<HandbookCopyLink targetId="handbook" label="Handbook" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Handbook' }));
    unmount();
    await act(async () => {
      resolveWrite?.();
      await Promise.resolve();
    });
    expect(window.location.hash).toBe('');
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
    window.location.hash = '';
    const { unmount } = render(<HandbookCopyLink targetId="handbook" label="Handbook" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Handbook' }));
    unmount();
    await act(async () => {
      rejectWrite?.(new Error('denied'));
      await Promise.resolve();
    });
    expect(window.location.hash).toBe('');
  });

  it('clears a pending reset timer on unmount', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = render(<HandbookCopyLink targetId="handbook" label="Handbook" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to Handbook' }));
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
    render(<HandbookCopyLink targetId="handbook" label="Handbook" />);
    const button = screen.getByRole('button', { name: 'Copy link to Handbook' });
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
    expect(button.textContent).toBe('Copied');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(button.textContent).toBe('Copy link');
  });
});
