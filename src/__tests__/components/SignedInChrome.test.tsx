import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import {
  fetchAccountActivity,
  fetchConversations,
  fetchModeratorGroup,
  fetchNotifications,
  fetchTrustProposals,
} from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { shouldOfferIosInstall } from '@/lib/pwa-install';
import { enablePush, isStandaloneDisplay, resyncPushSubscription } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import {
  FORUM_HOME_EVENT,
  consumePendingForumCompose,
  consumeSkipIntroduceOverlay,
  requestForumCompose,
} from '@/lib/forum-feed';

const replace = vi.fn();
const refresh = vi.fn();
const push = vi.fn();
const cancel = vi.fn();
const navigation = vi.hoisted(() => ({ pathname: '/profile' }));

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace; refresh: typeof refresh; push: typeof push } => ({
    replace,
    refresh,
    push,
  }),
  usePathname: (): string => navigation.pathname,
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (event: { preventDefault: () => void }) => void;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/hooks/useAccountTotals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useAccountTotals')>();
  return {
    useAccountTotals: vi.fn(actual.useAccountTotals),
  };
});
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/pwa-install', () => ({
  shouldOfferIosInstall: vi.fn(() => false),
}));
vi.mock('@/lib/push', () => ({
  isIosSafari: vi.fn(() => false),
  isStandaloneDisplay: vi.fn(() => false),
  resyncPushSubscription: vi.fn().mockResolvedValue(undefined),
  enablePush: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => false),
}));
vi.mock('@/lib/config', () => ({ getAppVersion: vi.fn(() => '74') }));
const EMPTY_FX = {
  quote: 'BTC-USD' as const,
  dayBasis: 'utc' as const,
  source: 'coinbase-exchange-daily-close' as const,
  quotes: [{ code: 'USD' as const, pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
};
const EMPTY_ACTIVITY = {
  donatedSats: 0,
  receivedSats: 0,
  donatedOverTime: [],
  receivedOverTime: [],
  fx: EMPTY_FX,
};

vi.mock('@/lib/api', () => ({
  fetchAccountActivity: vi.fn().mockResolvedValue({
    donatedSats: 0,
    receivedSats: 0,
    donatedOverTime: [],
    receivedOverTime: [],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
      quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
    },
  }),
  fetchNotifications: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
  fetchConversations: vi.fn().mockResolvedValue([]),
  fetchModeratorGroup: vi.fn().mockRejectedValue(new Error('no group')),
  fetchTrustProposals: vi.fn().mockResolvedValue([]),
}));

const useAccountTotalsActual = (
  await vi.importActual<typeof import('@/hooks/useAccountTotals')>('@/hooks/useAccountTotals')
).useAccountTotals;

function menuPanel(): HTMLElement {
  const panel = document.getElementById('signed-in-menu');
  expect(panel).not.toBeNull();
  return panel as HTMLElement;
}

function expectMenuClosed(): void {
  expect(menuPanel().className.includes('hidden')).toBe(true);
  expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false');
}

function expectMenuOpen(): void {
  const panel = menuPanel();
  const trigger = screen.getByRole('button', { name: 'Menu' });
  expect(panel.className.includes('hidden')).toBe(false);
  expect(panel.className).toContain('absolute');
  expect(panel.parentElement).toBe(trigger.parentElement);
  expect(panel.parentElement).not.toBe(document.body);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
}

beforeEach(() => {
  navigation.pathname = '/profile';
  replace.mockClear();
  refresh.mockClear();
  push.mockClear();
  cancel.mockClear();
  consumePendingForumCompose();
  consumeSkipIntroduceOverlay();
  vi.mocked(shouldOfferIosInstall).mockReturnValue(false);
  vi.mocked(isStandaloneDisplay).mockReturnValue(false);
  vi.mocked(isInAppBrowser).mockReturnValue(false);
  vi.mocked(useAccountTotals).mockImplementation(useAccountTotalsActual);
  vi.mocked(fetchAccountActivity).mockResolvedValue(EMPTY_ACTIVITY);
  vi.mocked(fetchNotifications).mockResolvedValue({ notifications: [], unreadCount: 0 });
  vi.mocked(fetchConversations).mockResolvedValue([]);
  vi.mocked(fetchModeratorGroup).mockRejectedValue(new Error('no group'));
  vi.mocked(fetchTrustProposals).mockResolvedValue([]);
  vi.mocked(resyncPushSubscription).mockResolvedValue(undefined);
  vi.mocked(enablePush).mockResolvedValue(undefined);
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel,
    error: null,
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
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
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: null,
      missing: [],
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('SignedInChrome', () => {
  it('shows Menu while Log out stays hidden', () => {
    renderWithLocale(<SignedInChrome />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expectMenuClosed();
  });

  it('keeps the menu open when mousedown stays on the panel', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.mouseDown(menuPanel());
    expectMenuOpen();
  });

  it('keeps the menu open when mousedown stays on the Menu trigger', () => {
    renderWithLocale(<SignedInChrome />);
    const trigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(trigger);
    expectMenuOpen();
    fireEvent.mouseDown(trigger);
    expectMenuOpen();
  });

  it('opens the menu with Profile and Log out, and omits zero totals', async () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/welcome');
    expect(screen.getByRole('link', { name: 'Shops' }).getAttribute('href')).toBe('/shops');
    expect(screen.getByRole('link', { name: /Profile/ }).getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/rules',
    );
    expect(screen.getByRole('link', { name: 'Trust Chain' }).getAttribute('href')).toBe(
      '/trust-chain',
    );
    const notifications = screen.getByRole('link', { name: 'Notifications' });
    const messages = screen.getByRole('link', { name: 'Messages' });
    expect(notifications.getAttribute('href')).toBe('/notifications');
    expect(notifications.getAttribute('aria-label')).toBe('Notifications');
    expect(messages.getAttribute('href')).toBe('/messages');
    expect(notifications.nextElementSibling).toBe(messages);
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('/contact');
    expect(screen.queryByLabelText('Language')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Deutsch' })).toBeNull();
    expect(screen.queryByLabelText('Theme')).toBeNull();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    expect(screen.getByText('Version 74')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Version 74/ })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Profile' })).toBeTruthy();
      expect(screen.queryByText('Loading…')).toBeNull();
      expect(screen.queryByLabelText('Given ₿0')).toBeNull();
      expect(screen.queryByLabelText('Received ₿0')).toBeNull();
    });
    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile.className.includes('items-center')).toBe(true);
    expect(profile.className.includes('flex-col')).toBe(false);
    expect(profile.querySelector('[aria-label="Given ₿0"]')).toBeNull();
    expect(profile.querySelector('[aria-label="Received ₿0"]')).toBeNull();
    expect(profile.textContent?.includes('·')).toBe(false);
    expect(profile.querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Home' }).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shops' }).querySelector('svg')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Living room rules' }).querySelector('svg'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Trust Chain' }).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Notifications' }).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Contact' }).querySelector('svg')).toBeTruthy();
  });

  it('shows the unread count on Notifications when greater than zero', async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({ notifications: [], unreadCount: 3 });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Notifications, 3 unread' })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Notifications, 3 unread' }).textContent).toContain(
      '3',
    );
    expect(screen.getByRole('link', { name: 'Messages' })).toBeTruthy();
  });

  it('shows the unread count on Messages when greater than zero', async () => {
    vi.mocked(fetchConversations).mockResolvedValue([
      {
        id: 'c1',
        kind: 'member_member',
        name: 'Bob',
        lastText: 'Hi',
        lastAt: '2026-08-28T12:00:00.000Z',
        lastFromMe: false,
        lastSats: 0,
        unreadMessageCount: 0,
        unread: true,
      },
      {
        id: 'c2',
        kind: 'member_member',
        name: 'Carol',
        lastText: 'Hey',
        lastAt: '2026-08-28T13:00:00.000Z',
        lastFromMe: false,
        lastSats: 0,
        unreadMessageCount: 0,
        unread: true,
      },
    ]);
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Messages, 2 unread' })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Messages, 2 unread' }).textContent).toContain('2');
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeTruthy();
  });

  it('swallows resync rejection on mount', async () => {
    cleanup();
    vi.mocked(resyncPushSubscription).mockRejectedValue(new Error('boom'));
    renderWithLocale(<SignedInChrome />);
    await waitFor(() => {
      expect(vi.mocked(resyncPushSubscription)).toHaveBeenCalledWith('tok');
    });
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
  });

  it('does not resync push when there is no session', () => {
    cleanup();
    vi.mocked(resyncPushSubscription).mockClear();
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<SignedInChrome />);
    expect(vi.mocked(resyncPushSubscription)).not.toHaveBeenCalled();
  });

  it('does not enable or resync push when Notifications is opened without a session', () => {
    cleanup();
    vi.mocked(enablePush).mockClear();
    vi.mocked(resyncPushSubscription).mockClear();
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    expect(vi.mocked(enablePush)).not.toHaveBeenCalled();
    expect(vi.mocked(resyncPushSubscription)).not.toHaveBeenCalled();
  });

  it('asks for OS permission when Notifications is opened without grant', () => {
    vi.mocked(enablePush).mockClear();
    vi.stubGlobal('Notification', { permission: 'default' });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    vi.stubGlobal('PushManager', function PushManager() {});
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    expect(vi.mocked(enablePush)).toHaveBeenCalledWith('tok');
  });

  it('does not ask for OS permission when PushManager is missing', () => {
    vi.mocked(enablePush).mockClear();
    vi.mocked(resyncPushSubscription).mockClear();
    vi.stubGlobal('Notification', { permission: 'default' });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    const original = window.PushManager;
    // @ts-expect-error coverage: missing PushManager
    delete window.PushManager;
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    window.PushManager = original;
    expect(vi.mocked(enablePush)).not.toHaveBeenCalled();
    expect(vi.mocked(resyncPushSubscription)).toHaveBeenCalledWith('tok');
  });

  it('resyncs the existing subscription when Notifications is opened with grant', () => {
    vi.mocked(enablePush).mockClear();
    vi.mocked(resyncPushSubscription).mockClear();
    vi.stubGlobal('Notification', { permission: 'granted' });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    expect(vi.mocked(enablePush)).not.toHaveBeenCalled();
    expect(vi.mocked(resyncPushSubscription)).toHaveBeenCalledWith('tok');
  });

  it('swallows enablePush and resync rejection on Notifications click', async () => {
    vi.mocked(enablePush).mockRejectedValue(new Error('denied'));
    vi.stubGlobal('Notification', { permission: 'denied' });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    vi.mocked(resyncPushSubscription).mockRejectedValue(new Error('boom'));
    vi.stubGlobal('Notification', { permission: 'granted' });
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    await waitFor(() => {
      expect(vi.mocked(resyncPushSubscription)).toHaveBeenCalled();
    });
  });

  it('ignores non-Escape keydown while the menu is open', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.keyDown(document, { key: 'Tab' });
    expectMenuOpen();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });

  it('closes the menu on Escape and restores focus to Menu', () => {
    renderWithLocale(<SignedInChrome />);
    const menuButton = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuButton);
    expectMenuOpen();
    screen.getByRole('button', { name: /log out/i }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expectMenuClosed();
    expect(document.activeElement).toBe(menuButton);
  });

  it('closes the menu on outside mousedown', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expectMenuClosed();
  });

  it('formats a single received amount as BIP-177 ₿1', async () => {
    vi.mocked(fetchAccountActivity).mockResolvedValue({
      ...EMPTY_ACTIVITY,
      receivedSats: 1,
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    await waitFor(() => {
      expect(screen.getByLabelText('Received ₿1')).toBeTruthy();
    });
    expect(screen.queryByLabelText(/Given/)).toBeNull();
    const profile = screen.getByRole('link', { name: /Profile/ });
    expect(profile.textContent?.includes('·')).toBe(false);
  });

  it("formats a single received amount as BIP-177 ₿1'000 and hides zero given", async () => {
    vi.mocked(fetchAccountActivity).mockResolvedValue({
      ...EMPTY_ACTIVITY,
      receivedSats: 1000,
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    await waitFor(() => {
      expect(screen.getByLabelText("Received ₿1'000")).toBeTruthy();
    });
    expect(screen.queryByLabelText(/Given/)).toBeNull();
    const profile = screen.getByRole('link', { name: /Profile/ });
    expect(profile.textContent?.includes('·')).toBe(false);
  });

  it('shows Loading… in the Profile totals while account totals are in flight', () => {
    vi.mocked(useAccountTotals).mockReturnValue({
      donatedSats: 0,
      receivedSats: 0,
      donateOverTime: [],
      receiveOverTime: [],
      loading: true,
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByLabelText(/Given/)).toBeNull();
    expect(screen.queryByLabelText(/Received/)).toBeNull();
  });

  it('shows a non-zero given amount and hides zero received', () => {
    vi.mocked(useAccountTotals).mockReturnValue({
      donatedSats: 1,
      receivedSats: 0,
      donateOverTime: [],
      receiveOverTime: [],
      loading: false,
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByLabelText('Given ₿1')).toBeTruthy();
    expect(screen.queryByLabelText(/Received/)).toBeNull();
    const profile = screen.getByRole('link', { name: /Profile/ });
    expect(profile.textContent?.includes('·')).toBe(false);
  });

  it('shows given and received with a middle dot when both sides are non-zero', () => {
    vi.mocked(useAccountTotals).mockReturnValue({
      donatedSats: 1,
      receivedSats: 1000,
      donateOverTime: [],
      receiveOverTime: [],
      loading: false,
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByLabelText('Given ₿1')).toBeTruthy();
    expect(screen.getByLabelText("Received ₿1'000")).toBeTruthy();
    const profile = screen.getByRole('link', { name: /Profile/ });
    expect(profile.textContent?.includes('·')).toBe(true);
  });

  it('closes the menu when Home is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expectMenuClosed();
  });

  it('closes the menu when Shops is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Shops' }));
    expectMenuClosed();
  });

  it('dispatches the forum home event instead of navigating when Home is already current', () => {
    navigation.pathname = '/welcome';
    const listener = vi.fn();
    window.addEventListener(FORUM_HOME_EVENT, listener);
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const clickCompleted = fireEvent.click(screen.getByRole('link', { name: 'Home' }));

    expect(clickCompleted).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expectMenuClosed();
    window.removeEventListener(FORUM_HOME_EVENT, listener);
  });

  it('leaves Home navigation intact on another pathname and closes the menu', () => {
    navigation.pathname = '/notifications';
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const clickCompleted = fireEvent.click(screen.getByRole('link', { name: 'Home' }));

    expect(clickCompleted).toBe(true);
    expectMenuClosed();
  });

  it('closes the menu when Profile is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /Profile/ }));
    expectMenuClosed();
  });

  it('closes the menu when Living room rules is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Living room rules' }));
    expectMenuClosed();
  });

  it('closes the menu when Trust Chain is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Trust Chain' }));
    expectMenuClosed();
  });

  it('omits Moderation for a basis account', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.queryByRole('link', { name: 'Moderation' })).toBeNull();
  });

  it('omits Moderation for a verified account', () => {
    const current = useAuthStore.getState().account;
    if (current === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...current, role: 'verified' } });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.queryByRole('link', { name: 'Moderation' })).toBeNull();
  });

  it('shows the unread count on Moderation when greater than zero', async () => {
    const current = useAuthStore.getState().account;
    if (current === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...current, role: 'moderator' } });
    vi.mocked(fetchModeratorGroup).mockResolvedValue({
      id: 'conv-mod',
      kind: 'moderator_group',
      name: 'Moderators',
      lastText: 'Hello mods',
      lastAt: '2026-08-28T15:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
      unreadMessageCount: 0,
      unread: true,
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Moderation, 1 unread' })).toBeTruthy();
    });
    const moderation = screen.getByRole('link', { name: 'Moderation, 1 unread' });
    expect(moderation.getAttribute('href')).toBe('/moderate');
    expect(moderation.textContent).toContain('1');
    const count = moderation.querySelector('.tabular-nums');
    expect(count?.textContent).toBe('1');
    expect(count?.className.includes('ml-auto')).toBe(true);
    expect(count?.className.includes('font-semibold')).toBe(true);
    expect(count?.className.includes('lining-nums')).toBe(true);
  });

  it('adds open-proposal count to the Moderation menu unread', async () => {
    const current = useAuthStore.getState().account;
    if (current === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...current, role: 'moderator' } });
    vi.mocked(fetchModeratorGroup).mockResolvedValue({
      id: 'conv-mod',
      kind: 'moderator_group',
      name: 'Moderators',
      lastText: 'Hello mods',
      lastAt: '2026-08-28T15:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
      unread: true,
      unreadMessageCount: 0,
    });
    vi.mocked(fetchTrustProposals).mockResolvedValue([
      {
        subject: { id: 'acc_rose', name: 'Rose', role: 'verified' },
        proposedBy: { id: 'acc_bob', name: 'Bob' },
        createdAt: '2026-08-28T12:00:00.000Z',
      },
    ]);
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Moderation, 2 unread' })).toBeTruthy();
    });
    const moderation = screen.getByRole('link', { name: 'Moderation, 2 unread' });
    expect(moderation.getAttribute('href')).toBe('/moderate');
    expect(moderation.querySelector('.tabular-nums')?.textContent).toBe('2');
  });

  it.each(['founder', 'moderator'] as const)(
    'shows Moderation after Trust Chain for a %s account and closes on click',
    (role) => {
      const current = useAuthStore.getState().account;
      if (current === null) {
        throw new Error('expected account');
      }
      useAuthStore.setState({ account: { ...current, role } });
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expectMenuOpen();
      const trustChain = screen.getByRole('link', { name: 'Trust Chain' });
      const moderation = screen.getByRole('link', { name: 'Moderation' });
      const notifications = screen.getByRole('link', { name: 'Notifications' });
      expect(moderation.getAttribute('href')).toBe('/moderate');
      expect(trustChain.nextElementSibling).toBe(moderation);
      expect(moderation.nextElementSibling).toBe(notifications);
      expect(moderation.querySelector('svg')).toBeTruthy();
      fireEvent.click(moderation);
      expectMenuClosed();
    },
  );

  it('closes the menu when Contact is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Contact' }));
    expectMenuClosed();
  });

  it('closes the menu when Notifications is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    expectMenuClosed();
  });

  it('closes the menu when Messages is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Messages' }));
    expectMenuClosed();
  });

  it('closes the menu when Install app is clicked and keeps the iOS sheet', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));
    expectMenuClosed();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows the introduce overlay when onboarding is done and hasPosted is false', () => {
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, hasPosted: false } });
    renderWithLocale(<SignedInChrome />);
    expect(screen.getByRole('dialog', { name: 'Introduce yourself' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write an introduction' })).toBeTruthy();
  });

  it('hides the introduce overlay when hasPosted is true', () => {
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, hasPosted: true } });
    renderWithLocale(<SignedInChrome />);
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
  });

  it('hides the introduce overlay during setup', () => {
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, setup: 'name', hasPosted: false } });
    renderWithLocale(<SignedInChrome />);
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
  });

  it('hides the introduce overlay when hasPosted is omitted', () => {
    renderWithLocale(<SignedInChrome />);
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
  });

  it('dismisses the introduce overlay for this mount', () => {
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, hasPosted: false } });
    renderWithLocale(<SignedInChrome />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(screen.queryByText('Close')).toBeNull();
    fireEvent.click(close);
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
  });

  it('hides the introduce overlay after Write an introduction on /welcome', () => {
    navigation.pathname = '/welcome';
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, hasPosted: false } });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Write an introduction' }));
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('does not show the introduce overlay after requestForumCompose on a fresh mount', () => {
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, hasPosted: false } });
    requestForumCompose();
    renderWithLocale(<SignedInChrome />);
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
  });
});
