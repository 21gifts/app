import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushToggle } from '@/components/PushToggle';
import { postHeartNotifications, postNotificationLevel } from '@/lib/api';
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
  postHeartNotifications: vi.fn(),
}));

const VIEW_KEY = 'a'.repeat(64);

const ACCOUNT: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: null,
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
  vi.mocked(postHeartNotifications).mockImplementation(async (_session, enabled) => ({
    ...ACCOUNT,
    notifyHearts: enabled,
  }));
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
    const device = await screen.findByRole('group', { name: 'Notifications' });
    expect(within(device).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(device).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('still shows the this-device control when getRegistration throws', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockRejectedValue(new Error('boom')) },
    });
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    expect(within(device).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('ignores a second On click while enable is in flight', async () => {
    let resolveEnable: (() => void) | undefined;
    vi.mocked(enablePush).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnable = resolve;
        }),
    );
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    const onButton = within(device).getByRole('button', { name: 'On' });
    fireEvent.click(onButton);
    fireEvent.click(onButton);
    await waitFor(() => {
      expect(enablePush).toHaveBeenCalledTimes(1);
    });
    resolveEnable?.();
    await waitFor(() => {
      expect(within(device).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  it('treats Off while unsubscribed as a no-op', async () => {
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    fireEvent.click(within(device).getByRole('button', { name: 'Off' }));
    expect(enablePush).not.toHaveBeenCalled();
    expect(disablePush).not.toHaveBeenCalled();
    expect(within(device).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('hides the device section when service worker or PushManager is missing and keeps the living room', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    expect(within(room).getByRole('button', { name: /^All$/ })).toBeTruthy();
    expect(screen.queryByText('On this device')).toBeNull();
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Notifications' })).toBeNull();
    });
  });

  it('shows a labeled On/Off notifications control when not subscribed', async () => {
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    const offButton = within(device).getByRole('button', { name: /^Off$/ });
    const onButton = within(device).getByRole('button', { name: /^On$/ });
    expect(screen.getByText('Notify me about:')).toBeTruthy();
    expect(screen.getByText('On this device')).toBeTruthy();
    expect(offButton.textContent).toBe('Off');
    expect(onButton.textContent).toBe('On');
    expect(offButton.getAttribute('aria-pressed')).toBe('true');
    expect(onButton.getAttribute('aria-pressed')).toBe('false');
    expect(offButton.className).toContain('bg-app-btn');
    expect(onButton.className).not.toContain('bg-app-btn');
    const room = screen.getByRole('group', { name: 'Posts' });
    expect(room.className).toContain('w-auto');
    expect(room.className).not.toContain('w-full');
    expect(within(room).queryByRole('button', { name: 'Only with a gift' })).toBeNull();
  });

  it('shows the iOS install hint when Safari is not standalone', async () => {
    vi.mocked(isIosSafari).mockReturnValue(true);
    vi.mocked(isStandaloneDisplay).mockReturnValue(false);
    renderWithLocale(<PushToggle />);
    expect(
      await screen.findByText('On iPhone, add 21.gifts to your Home Screen to get notifications.'),
    ).toBeTruthy();
    const device = screen.getByRole('group', { name: 'Notifications' });
    expect(within(device).getByRole('button', { name: 'Off' })).toBeTruthy();
  });

  it('enables push on On', async () => {
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    fireEvent.click(within(device).getByRole('button', { name: 'On' }));
    await waitFor(() => {
      expect(enablePush).toHaveBeenCalledWith('tok');
    });
    expect(within(device).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(device).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(within(device).getByRole('button', { name: 'On' }).className).toContain('bg-app-btn');
  });

  it('treats On while subscribed as a no-op', async () => {
    stubPushApis({ subscription: { endpoint: 'https://push.example/sub' } });
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    fireEvent.click(within(device).getByRole('button', { name: 'On' }));
    expect(enablePush).not.toHaveBeenCalled();
    expect(disablePush).not.toHaveBeenCalled();
    expect(within(device).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('disables push when already subscribed', async () => {
    stubPushApis({ subscription: { endpoint: 'https://push.example/sub' } });
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    const onButton = within(device).getByRole('button', { name: 'On' });
    const offButton = within(device).getByRole('button', { name: 'Off' });
    expect(onButton.getAttribute('aria-pressed')).toBe('true');
    expect(offButton.getAttribute('aria-pressed')).toBe('false');
    expect(onButton.className).toContain('bg-app-btn');
    fireEvent.click(offButton);
    await waitFor(() => {
      expect(disablePush).toHaveBeenCalledWith('tok');
    });
    expect(within(device).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(device).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('shows Off and unavailable copy when disablePush throws', async () => {
    stubPushApis({ subscription: { endpoint: 'https://push.example/sub' } });
    vi.mocked(disablePush).mockRejectedValueOnce(new Error('delete failed'));
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    expect(within(device).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(device).getByRole('button', { name: 'Off' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Notifications are not available in this browser.')).toBeTruthy();
    expect(within(device).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(device).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('shows unavailable copy when enable fails', async () => {
    vi.mocked(enablePush).mockRejectedValue(new Error('Notification permission denied'));
    renderWithLocale(<PushToggle />);
    const device = await screen.findByRole('group', { name: 'Notifications' });
    fireEvent.click(within(device).getByRole('button', { name: 'On' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Notifications are not available in this browser.')).toBeTruthy();
  });

  it('selects All on the living room when the level field is missing', () => {
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    expect(within(room).getByRole('button', { name: /^All$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      within(room)
        .getByRole('button', { name: /^Only to me$/ })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(within(room).getByRole('button', { name: /^Off$/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(within(room).queryByRole('button', { name: 'Only with a gift' })).toBeNull();
    expect(screen.getByText('Notify me about:')).toBeTruthy();
    expect(room.className).toContain('w-auto');
    expect(room.className).not.toContain('w-full');
  });

  it('selects Only to me when the account stores mentions', () => {
    useAuthStore.setState({ account: accountWithLevel('mentions') });
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    expect(
      within(room)
        .getByRole('button', { name: /^Only to me$/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(room).queryByRole('button', { name: 'Only with a gift' })).toBeNull();
  });

  it('posts none when Off is chosen on the living room', async () => {
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Off$/ }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'none');
    });
    expect(within(room).getByRole('button', { name: /^Off$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(useAuthStore.getState().account?.notificationLevel).toBe('none');
  });

  it('does not post when All is already selected', () => {
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^All$/ }));
    expect(postNotificationLevel).not.toHaveBeenCalled();
  });

  it('keeps All selected and shows an error when the level POST fails', async () => {
    vi.mocked(postNotificationLevel).mockRejectedValue(new Error('boom'));
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Off$/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not save notification level.')).toBeTruthy();
    expect(within(room).getByRole('button', { name: /^All$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
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
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Off$/ }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(within(room).getByRole('button', { name: /^Only to me$/ }));
    expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    resolvePost?.(accountWithLevel('none'));
    await waitFor(() => {
      expect(
        within(screen.getByRole('group', { name: 'Posts' }))
          .getByRole('button', { name: /^Off$/ })
          .getAttribute('aria-pressed'),
      ).toBe('true');
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
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Only to me$/ }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledTimes(1);
    });
    const current = useAuthStore.getState().account;
    expect(current).not.toBeNull();
    useAuthStore.getState().setAccount({ ...current!, name: 'Grace' });
    resolvePost?.({ ...accountWithLevel('mentions'), name: 'Ada' });
    await waitFor(() => {
      expect(useAuthStore.getState().account?.notificationLevel).toBe('mentions');
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
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Off$/ }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'none');
    });
    useAuthStore.getState().clearAuth();
    resolvePost?.(accountWithLevel('none'));
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
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Only to me$/ }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'mentions');
    });
    useAuthStore.setState({ account: null });
    resolvePost?.(accountWithLevel('mentions'));
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
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Only to me$/ }));
    await waitFor(() => {
      expect(useAuthStore.getState().account?.notificationLevel).toBe('mentions');
    });
  });

  it('selects All when the account is missing', () => {
    useAuthStore.setState({ account: null, session: 'tok' });
    renderWithLocale(<PushToggle />);
    expect(screen.getByText('Notify me about:')).toBeTruthy();
    const room = screen.getByRole('group', { name: 'Posts' });
    expect(within(room).getByRole('button', { name: /^All$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(room).queryByRole('button', { name: 'Only with a gift' })).toBeNull();
  });

  it('selects Off when the account stores none', () => {
    useAuthStore.setState({ account: accountWithLevel('none') });
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    expect(within(room).getByRole('button', { name: /^Off$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(room).queryByRole('button', { name: 'Only with a gift' })).toBeNull();
  });

  it('shows Only with a gift when the account stores active', () => {
    useAuthStore.setState({ account: accountWithLevel('active') });
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    expect(
      within(room)
        .getByRole('button', { name: /^Only with a gift$/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(room).getByRole('button', { name: /^All$/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(
      within(room)
        .getByRole('button', { name: /^Only to me$/ })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(within(room).getByRole('button', { name: /^Off$/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('does not post when Only with a gift is pressed again', () => {
    useAuthStore.setState({ account: accountWithLevel('active') });
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Only with a gift$/ }));
    expect(postNotificationLevel).not.toHaveBeenCalled();
  });

  it('posts all from stored active and drops Only with a gift', async () => {
    useAuthStore.setState({ account: accountWithLevel('active') });
    renderWithLocale(<PushToggle />);
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Posts' })).getByRole('button', {
        name: /^All$/,
      }),
    );
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'all');
      expect(
        within(screen.getByRole('group', { name: 'Posts' })).queryByRole('button', {
          name: 'Only with a gift',
        }),
      ).toBeNull();
    });
  });

  it('posts mentions from stored active and drops Only with a gift', async () => {
    useAuthStore.setState({ account: accountWithLevel('active') });
    renderWithLocale(<PushToggle />);
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Posts' })).getByRole('button', {
        name: /^Only to me$/,
      }),
    );
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'mentions');
      expect(
        within(screen.getByRole('group', { name: 'Posts' })).queryByRole('button', {
          name: 'Only with a gift',
        }),
      ).toBeNull();
    });
  });

  it('posts none from stored active and drops Only with a gift', async () => {
    useAuthStore.setState({ account: accountWithLevel('active') });
    renderWithLocale(<PushToggle />);
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Posts' })).getByRole('button', {
        name: /^Off$/,
      }),
    );
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'none');
      expect(
        within(screen.getByRole('group', { name: 'Posts' })).queryByRole('button', {
          name: 'Only with a gift',
        }),
      ).toBeNull();
    });
  });

  it('posts all when All is chosen from stored none', async () => {
    useAuthStore.setState({ account: accountWithLevel('none') });
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^All$/ }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'all');
    });
  });

  it('posts mentions when Only to me is chosen from stored none', async () => {
    useAuthStore.setState({ account: accountWithLevel('none') });
    renderWithLocale(<PushToggle />);
    const room = screen.getByRole('group', { name: 'Posts' });
    fireEvent.click(within(room).getByRole('button', { name: /^Only to me$/ }));
    await waitFor(() => {
      expect(postNotificationLevel).toHaveBeenCalledWith('tok', 'mentions');
    });
  });

  it('selects Hearts On when notifyHearts is omitted', () => {
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    expect(within(hearts).getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(hearts).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('posts enabled false when Hearts is turned off', async () => {
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    fireEvent.click(within(hearts).getByRole('button', { name: 'Off' }));
    await waitFor(() => {
      expect(postHeartNotifications).toHaveBeenCalledWith('tok', false);
    });
    expect(useAuthStore.getState().account?.notifyHearts).toBe(false);
    expect(within(hearts).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('does not post when Hearts On is already selected', () => {
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    fireEvent.click(within(hearts).getByRole('button', { name: 'On' }));
    expect(postHeartNotifications).not.toHaveBeenCalled();
  });

  it('ignores a second Hearts Off click while the POST is in flight', async () => {
    let resolvePost: ((account: Account) => void) | undefined;
    vi.mocked(postHeartNotifications).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    fireEvent.click(within(hearts).getByRole('button', { name: 'Off' }));
    await waitFor(() => {
      expect(postHeartNotifications).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(within(hearts).getByRole('button', { name: 'Off' }));
    expect(postHeartNotifications).toHaveBeenCalledTimes(1);
    resolvePost?.({ ...ACCOUNT, notifyHearts: false });
    await waitFor(() => {
      expect(within(hearts).getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  it('shows an error when the heart POST fails', async () => {
    vi.mocked(postHeartNotifications).mockRejectedValue(new Error('boom'));
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    fireEvent.click(within(hearts).getByRole('button', { name: 'Off' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not save the heart setting.')).toBeTruthy();
  });

  it('does not update notifyHearts when the session changes during the heart POST', async () => {
    let resolvePost: ((account: Account) => void) | undefined;
    vi.mocked(postHeartNotifications).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    fireEvent.click(within(hearts).getByRole('button', { name: 'Off' }));
    await waitFor(() => {
      expect(postHeartNotifications).toHaveBeenCalledTimes(1);
    });
    useAuthStore.setState({ session: 'other' });
    await act(async () => {
      resolvePost?.({ ...ACCOUNT, notifyHearts: false });
    });
    expect(useAuthStore.getState().session).toBe('other');
    expect(useAuthStore.getState().account?.notifyHearts).toBeUndefined();
  });

  it('does not restore a null account while the session remains during the heart POST', async () => {
    let resolvePost: ((account: Account) => void) | undefined;
    vi.mocked(postHeartNotifications).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    const setAccountSpy = vi.spyOn(useAuthStore.getState(), 'setAccount');
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    fireEvent.click(within(hearts).getByRole('button', { name: 'Off' }));
    await waitFor(() => {
      expect(postHeartNotifications).toHaveBeenCalledTimes(1);
    });
    useAuthStore.setState({ account: null });
    await act(async () => {
      resolvePost?.({ ...ACCOUNT, notifyHearts: false });
    });
    expect(useAuthStore.getState().account).toBeNull();
    expect(useAuthStore.getState().session).toBe('tok');
    expect(setAccountSpy).not.toHaveBeenCalled();
    setAccountSpy.mockRestore();
  });

  it('uses the posted heart flag when the response omits notifyHearts', async () => {
    vi.mocked(postHeartNotifications).mockResolvedValueOnce(ACCOUNT);
    renderWithLocale(<PushToggle />);
    const hearts = screen.getByRole('group', { name: 'Hearts' });
    fireEvent.click(within(hearts).getByRole('button', { name: 'Off' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account?.notifyHearts).toBe(false);
    });
  });
});
