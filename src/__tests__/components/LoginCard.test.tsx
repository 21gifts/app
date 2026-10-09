import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginCard } from '@/components/LoginCard';
import { usePasskeyLogin, type PasskeyStatus } from '@/hooks/usePasskeyLogin';
import { WRONG_ACCOUNT_ERROR } from '@/lib/api';
import { isInAppBrowser, openInSystemBrowser } from '@/lib/in-app-browser';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { Account } from '@/lib/api-types';

vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => false),
  openInSystemBrowser: vi.fn(),
}));

const loginSpy = vi.fn();
const registerSpy = vi.fn();
const submitNameSpy = vi.fn();
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
function mockPasskey(
  status: PasskeyStatus = 'idle',
  error: string | null = null,
  nameError: 'invalid' | 'taken' | null = null,
): void {
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status,
    login: loginSpy,
    register: registerSpy,
    submitName: submitNameSpy,
    authenticate: authenticateSpy,
    retry: retrySpy,
    cancel: cancelPasskeySpy,
    error: status === 'error' ? error : null,
    nameError: status === 'name' ? nameError : null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
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
  describe('held-back session', () => {
    beforeEach(() => {
      useAuthStore.setState({ lockedSession: 'held', lockedName: 'Ada' });
    });

    afterEach(() => {
      useAuthStore.setState({ lockedSession: null, lockedName: null });
    });

    it('is the ordinary login with a greeting, Open a new account, and no Log out', () => {
      renderWithLocale(<LoginCard />);
      expect(screen.getByText('Welcome back, Ada')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Log in with your device' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
      expect(screen.getByText('New to 21.gifts?')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Open a new account' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('greets nobody when the held account has no name', () => {
      useAuthStore.setState({ lockedName: null });
      renderWithLocale(<LoginCard />);
      expect(screen.queryByText(/Welcome back/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    });

    it('logs in with one authenticate prompt, never the account question', () => {
      renderWithLocale(<LoginCard />);
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
      expect(authenticateSpy).toHaveBeenCalledTimes(1);
      expect(loginSpy).not.toHaveBeenCalled();
    });

    it.each<PasskeyStatus>(['idle', 'error', 'unknown'])(
      'stays on the held view with the retry message after a %s prompt',
      (after) => {
        const view = renderWithLocale(<LoginCard />);
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
        mockPasskey(after, 'Failed');
        view.rerender(<LoginCard />);
        expect(screen.getByRole('alert').textContent).toBe(
          'Something went wrong. Please try again.',
        );
        expect(screen.getByText('Welcome back, Ada')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
        expect(screen.queryByText('This passkey is not an account')).toBeNull();
      },
    );

    it('shows a refused account on the held view and clears it on the next Log in', () => {
      const view = renderWithLocale(<LoginCard />);
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
      mockPasskey('error', WRONG_ACCOUNT_ERROR);
      view.rerender(<LoginCard />);
      expect(screen.getByRole('alert').textContent).toBe(
        'You signed in with the wrong account. Please try again with the correct account.',
      );
      expect(screen.getByText('Welcome back, Ada')).toBeTruthy();
      act(() => {
        useAuthStore.setState({ wrongAccount: true });
      });
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
      expect(useAuthStore.getState().wrongAccount).toBe(false);
      expect(authenticateSpy).toHaveBeenCalledTimes(2);
    });

    it('shows the failed wallet open as the retry message', () => {
      renderWithLocale(<LoginCard heldProblem="failed" />);
      expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Please try again.');
    });

    it('shows a passkey without PRF as the one no-wallet sentence', () => {
      renderWithLocale(<LoginCard heldProblem="noPrf" />);
      expect(screen.getByRole('alert').textContent).toBe(
        'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
      );
    });

    it('opens the name form for a new account and clears the retry message', () => {
      const view = renderWithLocale(<LoginCard />);
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
      mockPasskey('idle');
      view.rerender(<LoginCard />);
      expect(screen.getByRole('alert')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Open a new account' }));
      expect(registerSpy).toHaveBeenCalledTimes(1);
      mockPasskey('name');
      view.rerender(<LoginCard />);
      expect(screen.getByRole('heading', { name: 'Choose your name' })).toBeTruthy();
      mockPasskey('error', 'Failed to start passkey registration: 503');
      view.rerender(<LoginCard />);
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
      expect(screen.queryByText('Welcome back, Ada')).toBeNull();
    });

    it('forgets a dismissed try once a login signs in', () => {
      const view = renderWithLocale(<LoginCard />);
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
      act(() => {
        useAuthStore.setState({ account: { id: 'a' } as Account });
      });
      expect(cancelPasskeySpy).toHaveBeenCalled();
      act(() => {
        useAuthStore.setState({ account: null });
      });
      view.rerender(<LoginCard />);
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('shows the installed iOS version when the phone is below iOS 18', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)',
    });
    renderWithLocale(<LoginCard />);
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'iOS 17.5.1 is installed. Sign-in needs at least iOS 18.',
    );
  });

  it('hides the iOS version note on iOS 18', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    });
    renderWithLocale(<LoginCard />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says this phone or browser cannot hold a wallet when the new passkey has no PRF', async () => {
    mockPasskey('error', 'wallet.prfUnsupported');
    renderWithLocale(<LoginCard />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
    );
    expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('keeps the generic error for a failure that is not about PRF', async () => {
    mockPasskey('error', 'Failed to start passkey registration: 503');
    renderWithLocale(<LoginCard />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Something went wrong. Please try again.',
    );
  });

  it('shows the iOS version as the error when registration could not finish', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)',
    });
    mockPasskey('error', 'login.iosVersion');
    renderWithLocale(<LoginCard />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'iOS 17.5.1 is installed. Sign-in needs at least iOS 18.',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the Android version as the error when registration could not finish', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 8.1.0; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    mockPasskey('error', 'login.androidVersion');
    renderWithLocale(<LoginCard />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Android 8.1.0 is installed. Sign-in needs at least Android 9.',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the generic error when the iOS version key does not match the mounted Android', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 8.1.0; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    mockPasskey('error', 'login.iosVersion');
    renderWithLocale(<LoginCard />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows Log in and Open a new account when logged out and idle', () => {
    renderWithLocale(<LoginCard />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Log in', 'Open a new account']);
    expect(screen.getByText('New to 21.gifts?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('opens the name form from idle without starting login', () => {
    renderWithLocale(<LoginCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Open a new account' }));
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('shows the account choice with existing and new-account buttons', () => {
    mockPasskey('choice');
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('heading', { name: 'Do you already have an account?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Log in with existing account' }));
    expect(authenticateSpy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open a new account' }));
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith();
    expect(screen.queryByRole('button', { name: /^log in$/i })).toBeNull();
  });

  it('shows the unknown-passkey heading and create button', () => {
    mockPasskey('unknown');
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('heading', { name: 'This passkey is not an account' })).toBeTruthy();
    expect(
      screen.getByText(
        'This phone offered a passkey that 21.gifts does not recognize. Open a new account. If the phone offers that same passkey again, delete the saved 21.gifts passkey in your password settings, then try again.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open a new account' }));
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
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
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Something went wrong. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    expect(alert.className).not.toContain('text-app-muted');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('shows the dedicated wrong-account copy when passkey error is that string', () => {
    mockPasskey('error', WRONG_ACCOUNT_ERROR);
    renderWithLocale(<LoginCard />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(WRONG_ACCOUNT_ERROR);
    expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull();
    expect(alert.className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(retrySpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().wrongAccount).toBe(false);
  });

  it('shows the dedicated wrong-account copy when the store flag is set', () => {
    useAuthStore.setState({ wrongAccount: true });
    renderWithLocale(<LoginCard />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(WRONG_ACCOUNT_ERROR);
    expect(screen.queryByRole('button', { name: /^log in$/i })).toBeNull();
    expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(retrySpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().wrongAccount).toBe(false);
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

  it('opens the name form from choice without submitting', () => {
    function Harness(): ReactElement {
      const [status, setStatus] = useState<PasskeyStatus>('choice');
      vi.mocked(usePasskeyLogin).mockReturnValue({
        status,
        login: loginSpy,
        register: () => {
          setStatus('name');
        },
        submitName: submitNameSpy,
        authenticate: authenticateSpy,
        retry: retrySpy,
        cancel: cancelPasskeySpy,
        error: null,
        nameError: null,
      });
      return <LoginCard />;
    }
    renderWithLocale(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open a new account' }));
    expect(screen.getByRole('heading', { name: 'Choose your name' })).toBeTruthy();
    expect(submitNameSpy).not.toHaveBeenCalled();
  });

  it('opens the name form from unknown without submitting', () => {
    function Harness(): ReactElement {
      const [status, setStatus] = useState<PasskeyStatus>('unknown');
      vi.mocked(usePasskeyLogin).mockReturnValue({
        status,
        login: loginSpy,
        register: () => {
          setStatus('name');
        },
        submitName: submitNameSpy,
        authenticate: authenticateSpy,
        retry: retrySpy,
        cancel: cancelPasskeySpy,
        error: null,
        nameError: null,
      });
      return <LoginCard />;
    }
    renderWithLocale(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open a new account' }));
    expect(screen.getByRole('heading', { name: 'Choose your name' })).toBeTruthy();
    expect(submitNameSpy).not.toHaveBeenCalled();
  });

  it('shows invalid copy on empty name submit and does not call submitName', () => {
    mockPasskey('name');
    renderWithLocale(<LoginCard />);
    fireEvent.submit(screen.getByLabelText('Name').closest('form')!);
    expect(screen.getByRole('alert').textContent).toBe(
      'Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot.',
    );
    expect(submitNameSpy).not.toHaveBeenCalled();
  });

  it('shows taken copy when nameError is taken', () => {
    mockPasskey('name', null, 'taken');
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('alert').textContent).toBe('That username is already in use.');
  });

  it('submits a non-empty name draft', () => {
    mockPasskey('name');
    renderWithLocale(<LoginCard />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.submit(screen.getByLabelText('Name').closest('form')!);
    expect(submitNameSpy).toHaveBeenCalledWith('Ada');
  });

  it('clears the empty-name alert when the field is typed', () => {
    mockPasskey('name');
    renderWithLocale(<LoginCard />);
    fireEvent.submit(screen.getByLabelText('Name').closest('form')!);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(submitNameSpy).not.toHaveBeenCalled();
  });
});
