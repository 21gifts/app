import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushToggle } from '@/components/PushToggle';
import { postNotificationLevel } from '@/lib/api';
import type { Account, NotificationLevel } from '@/lib/api-types';
import { disablePush, enablePush, isIosSafari, isStandaloneDisplay } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/push', () => ({
  enablePush: vi.fn().mockResolvedValue(undefined),
  disablePush: vi.fn().mockResolvedValue(undefined),
  isIosSafari: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/api', () => ({
  postNotificationLevel: vi.fn(),
}));

const VIEW_KEY = 'a'.repeat(64);

const ACCOUNT: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1_700_000_001,
  viewKey: VIEW_KEY,
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

function accountWithLevel(level: NotificationLevel): Account {
  return { ...ACCOUNT, notificationLevel: level };
}

function stubPushApis(options?: { subscription?: { endpoint: string } | null }): void {
  const subscription = options?.subscription === undefined ? null : options.subscription;
  const getSubscription = vi.fn().mockResolvedValue(subscription);
  const getRegistration = vi.fn().mockResolvedValue({
    pushManager: { getSubscription },
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration },
  });
  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function PushManager() {
      return undefined;
    },
  });
}

beforeEach(() => {
  useAuthStore.setState({
    session: 'tok',
    account: ACCOUNT,
  });
  vi.mocked(isIosSafari).mockReturnValue(false);
  vi.mocked(isStandaloneDisplay).mockReturnValue(false);
  vi.mocked(enablePush).mockResolvedValue(undefined);
  vi.mocked(disablePush).mockResolvedValue(undefined);
  vi.mocked(postNotificationLevel).mockImplementation(async (_session, level) =>
    accountWithLevel(level),
  );
  stubPushApis();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PushToggle', () => {
  it('renders nothing without a session', async () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<PushToggle />);
    await waitFor(() => {
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  it('treats a missing registration as not subscribed', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    });
    renderWithLocale(<PushToggle />);
    expect(await screen.findByRole('button', { name: 'Enable notifications' })).toBeTruthy();
  });

  it('still shows the enable control when getRegistration throws', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockRejectedValue(new Error('boom')) },
    });
    renderWithLocale(<PushToggle />);
    expect(await screen.findByRole('button', { name: 'Enable notifications' })).toBeTruthy();
  });

  it('ignores a second click while enable is in flight', async () => {
    let resolveEnable: (() => void) | undefined;
    vi.mocked(enablePush).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnable = resolve;
        }),
    );
    renderWithLocale(<PushToggle />);
    const button = await screen.findByRole('button', { name: 'Enable notifications' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(enablePush).toHaveBeenCalledTimes(1);
    });
    resolveEnable?.();
    expect(await screen.findByRole('button', { name: 'Disable notifications' })).toBeTruthy();
  });

  it('hides the bell when service worker or PushManager is missing and keeps the level control', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    renderWithLocale(<PushToggle />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Enable notifications' })).toBeNull();
    });
    expect(screen.getByRole('group', { name: 'Notification level' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Active' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mentions' })).toBeTruthy();
  });

  it('shows an icon-only enable control when not subscribed', async () => {
    renderWithLocale(<PushToggle />);
    const button = await screen.findByRole('button', { name: 'Enable notifications' });
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.queryByText('On')).toBeNull();
    expect(screen.queryByText('Off')).toBeNull();
    expect(screen.queryByText('Enable notifications')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).toContain('border-app-border-strong');
    expect(button.className).not.toContain('bg-app-btn');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Notification level' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Active' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mentions' })).toBeTruthy();
  });

  it('shows the iOS install hint when Safari is not standalone', async () => {
    vi.mocked(isIosSafari).mockReturnValue(true);
    vi.mocked(isStandaloneDisplay).mockReturnValue(false);
    renderWithLocale(<PushToggle />);
    expect(
      await screen.findByText('On iPhone, add 21.gifts to your Home Screen to get notifications.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enable notifications' })).toBeTruthy();
  });

  it('enables push on click', async () => {
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    await waitFor(() => {
      expect(enablePush).toHaveBeenCalledWith('tok');
    });
    const button = await screen.findByRole('button', { name: 'Disable notifications' });
    expect(screen.queryByText('On')).toBeNull();
    expect(screen.queryByText('Off')).toBeNull();
    expect(screen.queryByText('Disable notifications')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.className).toContain('bg-app-btn');
    expect(button.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
  });

  it('disables push when already subscribed', async () => {
    stubPushApis({ subscription: { endpoint: 'https://push.example/sub' } });
    renderWithLocale(<PushToggle />);
    const subscribedButton = await screen.findByRole('button', { name: 'Disable notifications' });
    expect(screen.queryByText('On')).toBeNull();
    expect(screen.queryByText('Off')).toBeNull();
    expect(screen.queryByText('Disable notifications')).toBeNull();
    expect(subscribedButton.getAttribute('aria-pressed')).toBe('true');
    expect(subscribedButton.className).toContain('bg-app-btn');
    expect(subscribedButton.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
    fireEvent.click(subscribedButton);
    await waitFor(() => {
      expect(disablePush).toHaveBeenCalledWith('tok');
    });
    const button = await screen.findByRole('button', { name: 'Enable notifications' });
    expect(screen.queryByText('On')).toBeNull();
    expect(screen.queryByText('Off')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).not.toContain('bg-app-btn');
  });

  it('shows unavailable copy when enable fails', async () => {
    vi.mocked(enablePush).mockRejectedValue(new Error('Notification permission denied'));
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Notifications are not available in this browser.')).toBeTruthy();
  });

  it('shows the three notification stages and selects All when the field is missing', async () => {
    renderWithLocale(<PushToggle />);
    expect(await screen.findByRole('group', { name: 'Notification level' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Active' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Mentions' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(
      screen.getByText(
        'All living-room posts, replies, and gifts. Active is posts with gifts. Mentions is admin posts, replies to you, and gifts you receive.',
      ),
    ).toBeTruthy();
  });

  it('selects Mentions when the account stores that level', async () => {
    useAuthStore.setState({ account: accountWithLevel('mentions') });
    renderWithLocale(<PushToggle />);
    expect(await screen.findByRole('button', { name: 'Mentions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mentions' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('posts Active and presses that option', async () => {
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Active' }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'active');
    });
    expect(screen.getByRole('button', { name: 'Active' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(useAuthStore.getState().account?.notificationLevel).toBe('active');
  });

  it('does not post when All is already selected', async () => {
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'All' }));
    expect(postNotificationLevel).not.toHaveBeenCalled();
  });

  it('keeps All and shows an error when the level POST fails', async () => {
    vi.mocked(postNotificationLevel).mockRejectedValue(new Error('boom'));
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Active' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not save notification level.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    expect(useAuthStore.getState().account?.notificationLevel).toBeUndefined();
  });

  it('ignores a second level click while the POST is in flight', async () => {
    let resolvePost: ((account: Account) => void) | undefined;
    vi.mocked(postNotificationLevel).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Active' }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mentions' }));
    expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    resolvePost?.(accountWithLevel('active'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Active' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  it('merges notificationLevel without replacing a concurrent name edit', async () => {
    let resolvePost: ((account: Account) => void) | undefined;
    vi.mocked(postNotificationLevel).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Active' }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    });
    const current = useAuthStore.getState().account;
    expect(current).not.toBeNull();
    useAuthStore.getState().setAccount({ ...current!, name: 'Grace' });
    resolvePost?.({ ...accountWithLevel('active'), name: 'Ada' });
    await waitFor(() => {
      expect(useAuthStore.getState().account?.notificationLevel).toBe('active');
    });
    expect(useAuthStore.getState().account?.name).toBe('Grace');
  });

  it('does not restore an account after logout during the level POST', async () => {
    let resolvePost: ((account: Account) => void) | undefined;
    vi.mocked(postNotificationLevel).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Active' }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    });
    useAuthStore.getState().clearAuth();
    resolvePost?.(accountWithLevel('active'));
    await waitFor(() => {
      expect(useAuthStore.getState().session).toBeNull();
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not restore a null account while the session remains during the level POST', async () => {
    let resolvePost: ((account: Account) => void) | undefined;
    vi.mocked(postNotificationLevel).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    const setAccountSpy = vi.spyOn(useAuthStore.getState(), 'setAccount');
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Active' }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    });
    useAuthStore.setState({ account: null });
    resolvePost?.(accountWithLevel('active'));
    await waitFor(() => {
      expect(useAuthStore.getState().account).toBeNull();
    });
    expect(useAuthStore.getState().session).toBe('tok');
    expect(setAccountSpy).not.toHaveBeenCalled();
    setAccountSpy.mockRestore();
  });

  it('uses the posted level when the response omits notificationLevel', async () => {
    vi.mocked(postNotificationLevel).mockResolvedValueOnce(ACCOUNT);
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Active' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account?.notificationLevel).toBe('active');
    });
  });

  it('selects All when the account is missing', async () => {
    useAuthStore.setState({ account: null, session: 'tok' });
    renderWithLocale(<PushToggle />);
    expect(await screen.findByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
  });
});
