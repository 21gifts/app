import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginCard } from '@/components/LoginCard';
import { usePasskeyLogin, type PasskeyStatus } from '@/hooks/usePasskeyLogin';
import { isInAppBrowser, openInSystemBrowser } from '@/lib/in-app-browser';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => false),
  openInSystemBrowser: vi.fn(),
}));

const loginSpy = vi.fn();
const registerSpy = vi.fn();
const authenticateSpy = vi.fn();
const retrySpy = vi.fn();
const cancelPasskeySpy = vi.fn();

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

/** Points the mocked passkey hook at a fixed state for the next render. */
function mockPasskey(status: PasskeyStatus = 'idle'): void {
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status,
    login: loginSpy,
    register: registerSpy,
    authenticate: authenticateSpy,
    retry: retrySpy,
    cancel: cancelPasskeySpy,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(isInAppBrowser).mockReturnValue(false);
  mockPasskey('idle');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.assign(navigator, { clipboard: originalClipboard });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: originalExecCommand,
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
});

describe('LoginCard', () => {
  it('shows a single Log in button when logged out and idle', () => {
    renderWithLocale(<LoginCard />);
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows a loading state while a passkey ceremony starts', () => {
    mockPasskey('starting');
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Preparing your login…')).toBeTruthy();
  });

  it('shows preparing when a signed-in account is already in the store', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
      },
    });
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Preparing your login…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^log in$/i })).toBeNull();
    expect(cancelPasskeySpy).toHaveBeenCalled();
  });

  it('shows a passkey error with try again', () => {
    mockPasskey('error');
    renderWithLocale(<LoginCard />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('shows the in-app escape card when isInAppBrowser is true', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Open this page in your browser' })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /^log in$/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open in browser' }));
    expect(openInSystemBrowser).toHaveBeenCalledWith(
      `${window.location.origin}${window.location.pathname}`,
    );
  });

  it('shows the in-app card when passkey status is unsupported', () => {
    mockPasskey('unsupported');
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('heading', { name: 'Open this page in your browser' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^log in$/i })).toBeNull();
  });

  it('marks Copy link as copied after clipboard succeeds when fallback fails', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' }).getAttribute('data-copied')).toBe(
        'true',
      );
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${window.location.pathname}`);
  });

  it('uses sync execCommand first and shows Copied without waiting for clipboard', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    const writeText = vi.fn(
      () =>
        new Promise<void>(() => {
          /* never settles */
        }),
    );
    Object.assign(navigator, { clipboard: { writeText } });
    const exec = stubExecCommand(() => true);
    renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('button', { name: 'Copied' }).getAttribute('data-copied')).toBe('true');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('stays idle and logs once when clipboard and fallback both fail', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole('button', { name: 'Copy link' }).getAttribute('data-copied'),
    ).toBeNull();
  });

  it('stays idle and logs when execCommand throws then clipboard rejects', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    stubExecCommand(() => {
      throw new Error('no exec');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(writeText).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Copy link' }).getAttribute('data-copied'),
    ).toBeNull();
  });

  it('shows the iOS hint when the user agent is an iPhone', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(
        screen.getByText('On iPhone, tap the compass or Safari icon at the top right.'),
      ).toBeTruthy();
    });
  });

  it('unmounts the in-app view without throwing', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    const { unmount } = renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Open this page in your browser' })).toBeTruthy();
    });
    unmount();
  });

  it('ignores a clipboard write that resolves after unmount', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    stubExecCommand(() => false);
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });
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
    vi.mocked(isInAppBrowser).mockReturnValue(true);
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
    const { unmount } = renderWithLocale(<LoginCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });
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
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = renderWithLocale(<LoginCard />);
    await act(async () => {
      await Promise.resolve();
    });
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
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<LoginCard />);
    await act(async () => {
      await Promise.resolve();
    });
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
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    stubExecCommand(() => false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithLocale(<LoginCard />);
    await act(async () => {
      await Promise.resolve();
    });
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
