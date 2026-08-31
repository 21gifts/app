import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { openInSystemBrowser } from '@/lib/in-app-browser';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => true),
  openInSystemBrowser: vi.fn(),
}));

const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;
const originalUserAgent = navigator.userAgent;

function stubExecCommand(impl: (commandId: string) => boolean): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: fn,
  });
  return fn;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: originalExecCommand,
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
});

describe('InAppBrowserView', () => {
  it('renders the escape heading and Open in browser', () => {
    renderWithLocale(<InAppBrowserView />);
    expect(screen.getByRole('heading', { name: 'Open this page in your browser' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open in browser' }));
    expect(openInSystemBrowser).toHaveBeenCalledWith(
      `${window.location.origin}${window.location.pathname}`,
    );
  });

  it('marks Copy link as copied after clipboard succeeds when fallback fails', async () => {
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' }).getAttribute('data-copied')).toBe(
        'true',
      );
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${window.location.pathname}`);
  });

  it('uses sync execCommand first and shows Copied without waiting for clipboard', () => {
    const writeText = vi.fn(
      () =>
        new Promise<void>(() => {
          /* never settles */
        }),
    );
    Object.assign(navigator, { clipboard: { writeText } });
    const exec = stubExecCommand(() => true);
    renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('button', { name: 'Copied' }).getAttribute('data-copied')).toBe('true');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('stays idle and logs once when clipboard and fallback both fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole('button', { name: 'Copy link' }).getAttribute('data-copied'),
    ).toBeNull();
  });

  it('stays idle and logs when execCommand throws then clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => {
      throw new Error('no exec');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(writeText).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Copy link' }).getAttribute('data-copied'),
    ).toBeNull();
  });

  it('shows the iOS hint when the user agent is an iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    renderWithLocale(<InAppBrowserView />);
    expect(
      screen.getByText('On iPhone, tap the compass or Safari icon at the top right.'),
    ).toBeTruthy();
  });

  it('unmounts without throwing', () => {
    const { unmount } = renderWithLocale(<InAppBrowserView />);
    expect(screen.getByRole('heading', { name: 'Open this page in your browser' })).toBeTruthy();
    unmount();
  });

  it('ignores a clipboard write that resolves after unmount', async () => {
    stubExecCommand(() => false);
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalled();
    unmount();
    await act(async () => {
      resolveWrite?.();
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });

  it('ignores a clipboard reject that settles after unmount', async () => {
    const exec = stubExecCommand(() => false);
    let rejectWrite: ((error: Error) => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectWrite = reject;
        }),
    );
    Object.assign(navigator, { clipboard: { writeText } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(writeText).toHaveBeenCalled();
    unmount();
    await act(async () => {
      rejectWrite?.(new Error('denied'));
      await Promise.resolve();
    });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });

  it('clears a pending reset timer on unmount', async () => {
    vi.useFakeTimers();
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
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
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByRole('button', { name: 'Copied' }).getAttribute('data-copied')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(
      screen.getByRole('button', { name: 'Copy link' }).getAttribute('data-copied'),
    ).toBeNull();
  });

  it('restores Copy link after the copied timer elapses', async () => {
    vi.useFakeTimers();
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<InAppBrowserView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Copied' }).getAttribute('data-copied')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(
      screen.getByRole('button', { name: 'Copy link' }).getAttribute('data-copied'),
    ).toBeNull();
  });
});
