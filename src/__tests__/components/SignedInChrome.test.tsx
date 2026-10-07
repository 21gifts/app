import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/AppShell';
import { SignedInChrome } from '@/components/SignedInChrome';
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
import { previousViewPath, recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
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
vi.mock('@/lib/config', () => ({
  getAppVersion: vi.fn(() => '74'),
  getBreezApiKey: vi.fn(() => null),
  getE2eNow: vi.fn(() => null),
}));
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
    submitName: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel,
    error: null,
    nameError: null,
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
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
  delete document.documentElement.dataset['menuSheet'];
  resetViewHistory();
});

function stubMatchMedia(matches: boolean): () => void {
  const previous = window.matchMedia.bind(window);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  return () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: previous,
    });
  };
}

function trackScrollTop(
  scroller: HTMLElement,
  initial: number,
): { read: () => number; log: string[] } {
  let top = initial;
  const log: string[] = [];
  const sheet = (): string => document.documentElement.dataset['menuSheet'] ?? 'off';
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => {
      log.push(`get:${top}:sheet=${sheet()}`);
      return top;
    },
    set: (value: number) => {
      log.push(`set:${value}:sheet=${sheet()}`);
      top = value;
    },
  });
  return { read: () => top, log };
}

function follows(earlier: Node, later: Node): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** Wallet links outside the Menu panel: the header wallet button only. */
function headerWalletLinks(): HTMLElement[] {
  return screen
    .queryAllByRole('link', { name: 'Wallet' })
    .filter((link) => !menuPanel().contains(link));
}

describe('SignedInChrome', () => {
  it('shows no header wallet button while this build has no wallet', () => {
    renderWithLocale(<SignedInChrome />);
    expect(headerWalletLinks()).toEqual([]);
  });

  it('places the header wallet button just left of Menu when the wallet is set up', () => {
    const account = useAuthStore.getState().account!;
    useAuthStore.setState({
      account: { ...account, walletRequired: true, passkeyCredentialId: 'credential' },
    });
    useWalletStore.setState({ status: 'locked', balanceSats: null });
    try {
      renderWithLocale(<SignedInChrome />);
      const [wallet] = headerWalletLinks();
      expect(headerWalletLinks()).toHaveLength(1);
      expect(wallet?.getAttribute('href')).toBe('/wallet');
      expect(
        wallet?.nextElementSibling?.contains(screen.getByRole('button', { name: 'Menu' })),
      ).toBe(true);
      expectMenuClosed();
    } finally {
      useWalletStore.getState().reset();
    }
  });

  it('shows Menu while Log out stays hidden', () => {
    renderWithLocale(<SignedInChrome />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Menu' }).className).not.toContain('z-[60]');
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
    expect(screen.getByRole('link', { name: 'Point of sale' }).getAttribute('href')).toBe('/pos');
    fireEvent.click(screen.getByRole('link', { name: 'Point of sale' }));
    expectMenuClosed();
    expect(screen.getByRole('link', { name: /Profile/ }).getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('link', { name: 'Grants' }).getAttribute('href')).toBe('/grants');
    expect(screen.getByRole('link', { name: 'Wallet' }).getAttribute('href')).toBe('/wallet');
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings');
    expect(menuPanel().firstElementChild).toBe(screen.getByRole('link', { name: 'Wallet' }));
    expect(screen.getByRole('link', { name: 'Wallet' }).nextElementSibling).toBe(
      screen.getByRole('link', { name: 'Home' }),
    );
    expect(screen.getByRole('link', { name: 'Grants' }).nextElementSibling).toBe(
      screen.getByRole('link', { name: 'Settings' }),
    );
    expect(
      follows(
        screen.getByRole('link', { name: 'Settings' }),
        screen.getByRole('link', { name: 'Living room rules' }),
      ),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/rules',
    );
    const habitTracker = screen.getByRole('link', { name: 'Habit-Tracker' });
    expect(habitTracker.getAttribute('href')).toBe('/habit-tracker');
    fireEvent.click(habitTracker);
    expect(screen.getByRole('link', { name: 'Living room rules' }).nextElementSibling).toBe(
      habitTracker,
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
    expect(screen.queryByRole('link', { name: 'Statistics' })).toBeNull();
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

  it('does not show given or received amounts on Profile', async () => {
    vi.mocked(fetchAccountActivity).mockResolvedValue({
      ...EMPTY_ACTIVITY,
      donatedSats: 1,
      receivedSats: 1000,
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    const profile = await screen.findByRole('link', { name: 'Profile' });
    expect(profile.textContent?.replace(/\s+/g, ' ').trim()).toBe('Profile');
    expect(screen.queryByLabelText(/Given/)).toBeNull();
    expect(screen.queryByLabelText(/Received/)).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
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

  it('does not offer a Map page in the menu', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.queryByRole('link', { name: 'Map' })).toBeNull();
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

  it('clears the view stack in memory and storage on a plain Home click', () => {
    navigation.pathname = '/notifications';
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    expect(previousViewPath()).toBe('/shops');
    expect(sessionStorage.getItem('21gifts.viewHistory')).not.toBeNull();
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const clickCompleted = fireEvent.click(screen.getByRole('link', { name: 'Home' }));

    expect(clickCompleted).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(previousViewPath()).toBeNull();
    expect(sessionStorage.getItem('21gifts.viewHistory')).toBeNull();
    recordCurrentView('/welcome');
    recordCurrentView('/shops');
    expect(previousViewPath()).toBe('/welcome');
  });

  it.each([
    ['metaKey', { metaKey: true }],
    ['ctrlKey', { ctrlKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['altKey', { altKey: true }],
    ['a middle button', { button: 1 }],
  ])('keeps the view stack on a Home click with %s', (_label, init) => {
    navigation.pathname = '/notifications';
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    fireEvent.click(screen.getByRole('link', { name: 'Home' }), init);

    expect(previousViewPath()).toBe('/shops');
    expect(sessionStorage.getItem('21gifts.viewHistory')).not.toBeNull();
  });

  it('leaves the forum home as the only view on a plain Home click on /welcome', () => {
    navigation.pathname = '/welcome';
    window.history.pushState(null, '', '/shops');
    recordCurrentView('/shops');
    window.history.pushState(null, '', '/welcome');
    recordCurrentView('/welcome');
    expect(previousViewPath()).toBe('/shops');
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const clickCompleted = fireEvent.click(screen.getByRole('link', { name: 'Home' }));

    expect(clickCompleted).toBe(false);
    expect(previousViewPath()).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('21gifts.viewHistory') ?? 'null')).toEqual({
      stack: ['/welcome'],
      cursor: 0,
    });
    recordCurrentView('/shops');
    expect(previousViewPath()).toBe('/welcome');
  });

  it('keeps the view stack on a modified Home click on /welcome', () => {
    navigation.pathname = '/welcome';
    window.history.pushState(null, '', '/shops');
    recordCurrentView('/shops');
    window.history.pushState(null, '', '/welcome');
    recordCurrentView('/welcome');
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    fireEvent.click(screen.getByRole('link', { name: 'Home' }), { metaKey: true });

    expect(previousViewPath()).toBe('/shops');
  });

  it('closes the menu when Profile is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Wallet' }));
    fireEvent.click(screen.getByRole('link', { name: /Profile/ }));
    expectMenuClosed();
  });

  it('closes the menu when Grants is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Grants' }));
    expectMenuClosed();
  });

  it('closes the menu when Settings is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
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
    const trustChain = screen.getByRole('link', { name: 'Trust Chain' });
    const statistics = screen.getByRole('link', { name: 'Statistics' });
    expect(statistics.getAttribute('href')).toBe('/statistics');
    expect(trustChain.nextElementSibling).toBe(statistics);
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
    const trustChain = screen.getByRole('link', { name: 'Trust Chain' });
    const statistics = screen.getByRole('link', { name: 'Statistics' });
    expect(statistics.getAttribute('href')).toBe('/statistics');
    expect(trustChain.nextElementSibling).toBe(statistics);
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
    const statistics = screen.getByRole('link', { name: 'Statistics' });
    expect(statistics.getAttribute('href')).toBe('/statistics');
    expect(statistics.querySelector('.tabular-nums')).toBeNull();
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
      const statistics = screen.getByRole('link', { name: 'Statistics' });
      const moderation = screen.getByRole('link', { name: 'Moderation' });
      const notifications = screen.getByRole('link', { name: 'Notifications' });
      expect(statistics.getAttribute('href')).toBe('/statistics');
      expect(moderation.getAttribute('href')).toBe('/moderate');
      expect(trustChain.nextElementSibling).toBe(statistics);
      expect(statistics.nextElementSibling).toBe(moderation);
      expect(moderation.nextElementSibling).toBe(notifications);
      expect(statistics.querySelector('svg')).toBeTruthy();
      expect(moderation.querySelector('svg')).toBeTruthy();
      fireEvent.click(statistics);
      expectMenuClosed();
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expectMenuOpen();
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

  it('keeps the iOS install sheet when a narrow menu closes', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    const restore = stubMatchMedia(true);
    try {
      renderWithLocale(
        <AppShell mode="fill" topRight={<SignedInChrome />}>
          <p>Note</p>
        </AppShell>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(document.querySelector('[data-menu-sheet-host]')?.contains(panel)).toBe(true);
      fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));
      expectMenuClosed();
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(menuPanel()).toBe(panel);
      expect(document.querySelector('[data-menu-sheet-host]')?.contains(panel)).toBe(true);
      expect(panel.className).toContain('w-full');
      expect(panel.className).toContain('hidden');
      expect(panel.className).not.toContain('absolute');
    } finally {
      restore();
    }
  });

  it('shows the introduce overlay on /welcome when onboarding is done and hasPosted is false', () => {
    navigation.pathname = '/welcome';
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

  it.each([
    '/wallet',
    '/wallet/phrase',
    '/pos',
    '/pos/amount',
    '/profile',
    '/messages',
    '/messages/msg-1',
    '/setup/name',
    '/setup/username',
    '/setup/rules',
    '/notifications',
    '/shops',
  ])('never shows the introduce overlay over %s', (path) => {
    navigation.pathname = path;
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, hasPosted: false } });
    renderWithLocale(<SignedInChrome />);
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
  });

  it('dismisses the introduce overlay for this mount', () => {
    navigation.pathname = '/welcome';
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
    navigation.pathname = '/welcome';
    const account = useAuthStore.getState().account;
    if (account === null) {
      throw new Error('expected account');
    }
    useAuthStore.setState({ account: { ...account, hasPosted: false } });
    requestForumCompose();
    renderWithLocale(<SignedInChrome />);
    expect(screen.queryByRole('dialog', { name: 'Introduce yourself' })).toBeNull();
  });

  it('opens a full-width sheet without a shell scroller when the viewport is narrow', () => {
    const restore = stubMatchMedia(true);
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('w-full');
      expect(panel.className).not.toContain('absolute');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(document.getElementById('signed-in-menu-scrim')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expect(document.documentElement.dataset['menuSheet']).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('pins a narrow menu in the sheet host and restores the page scroll', () => {
    const restore = stubMatchMedia(true);
    try {
      renderWithLocale(
        <AppShell mode="fill" topRight={<SignedInChrome />}>
          <p>Note</p>
        </AppShell>,
      );
      const scroller = document.querySelector('[data-scrollport]');
      if (!(scroller instanceof HTMLElement)) {
        throw new Error('missing scrollport');
      }
      const scroll = trackScrollTop(scroller, 80);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(document.querySelector('[data-menu-sheet-host]')?.contains(panel)).toBe(true);
      expect(document.querySelector('[data-menu-sheet-host]')?.className).toContain('px-8');
      expect(panel.className).toContain('w-full');
      expect(panel.className).not.toContain('absolute');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(scroll.read()).toBe(0);
      expect(scroll.log).toContain('get:80:sheet=off');
      expect(scroll.log).toContain('set:0:sheet=1');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.documentElement.dataset['menuSheet']).toBeUndefined();
      expect(scroll.log.at(-1)).toBe('set:80:sheet=off');
      expect(scroll.read()).toBe(80);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));
      expect(menuPanel()).toBe(panel);
      expect(document.querySelector('[data-menu-sheet-host]')?.contains(panel)).toBe(true);
      expect(panel.className).toContain('hidden');
      expect(panel.className).toContain('w-full');
      expect(panel.className).not.toContain('absolute');
    } finally {
      restore();
    }
  });

  it('closes a wide menu from the scrim', () => {
    const restore = stubMatchMedia(false);
    try {
      renderWithLocale(
        <AppShell mode="fill" topRight={<SignedInChrome />}>
          <p>Note</p>
        </AppShell>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expectMenuOpen();
      const scrim = document.getElementById('signed-in-menu-scrim');
      if (!(scrim instanceof HTMLButtonElement)) {
        throw new Error('missing menu scrim');
      }
      expect(scrim.getAttribute('aria-label')).toBe('Close menu');
      expect(scrim.className).toContain('rounded-3xl');
      expect(scrim.tabIndex).toBe(-1);
      expect(document.querySelector('[data-menu-scrim-host]')?.contains(scrim)).toBe(true);
      fireEvent.click(scrim);
      expectMenuClosed();
    } finally {
      restore();
    }
  });

  it('follows the measured frame width instead of the viewport media query', () => {
    const restore = stubMatchMedia(false);
    const callbacks: ResizeObserverCallback[] = [];
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }

      observe(): void {}

      unobserve(): void {}

      disconnect(): void {}
    }
    const previousObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    });
    try {
      renderWithLocale(
        <AppShell mode="fill" topRight={<SignedInChrome />}>
          <p>Note</p>
        </AppShell>,
      );
      const scroller = document.querySelector('[data-scrollport]');
      const frame = document.querySelector('[data-app-frame]');
      const callback = callbacks.at(-1);
      if (
        !(scroller instanceof HTMLElement) ||
        !(frame instanceof Element) ||
        callback === undefined
      ) {
        throw new Error('missing frame measurement');
      }
      const scroll = trackScrollTop(scroller, 80);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expect(menuPanel().className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(scroll.read()).toBe(0);
      expect(document.getElementById('signed-in-menu-scrim')).toBeNull();
      act(() => {
        callback(
          [
            {
              target: frame,
              contentBoxSize: [{ inlineSize: 800 }],
              contentRect: { width: 800 },
            } as unknown as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        );
      });
      expect(document.documentElement.dataset['menuSheet']).toBeUndefined();
      expect(scroll.read()).toBe(80);
      const scrim = document.getElementById('signed-in-menu-scrim');
      if (!(scrim instanceof HTMLButtonElement)) {
        throw new Error('missing menu scrim');
      }
      expect(menuPanel().className).toContain('absolute');
      expect(menuPanel().className).toContain('w-72');
      expect(menuPanel().className).toContain('mt-2');
      expect(menuPanel().className).toContain('p-2');
      expect(menuPanel().className).not.toContain('overflow-y-auto');
      expect(menuPanel().className).not.toContain('100%');
      fireEvent.click(scrim);
      expectMenuClosed();
    } finally {
      restore();
      globalThis.ResizeObserver = previousObserver;
      if (widthDescriptor === undefined) {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      } else {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDescriptor);
      }
    }
  });

  it('drops the wide menu outer spacing when it would stick out of a 720px window', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    let bottom = 751;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      const current = useAuthStore.getState().account;
      if (current === null) {
        throw new Error('expected account');
      }
      useAuthStore.setState({ account: { ...current, role: 'moderator' } });
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(panel.className).not.toContain('absolute');
      expect(panel.className).not.toContain('overflow-y-auto');
      expect(panel.className).not.toContain('min-h-8');
      expect(panel.className).not.toContain('max-h-');
      expect(panel.style.transform).toBe('');
      expect(panel.querySelector('a')?.className).toContain('min-h-11');
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      bottom = 700;
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expect(panel.className).toContain('mt-2');
      expect(panel.className).toContain('p-2');
      expect(panel.className).not.toContain('mt-0');
      expect(panel.className).not.toContain('overflow-y-auto');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('keeps the wide menu outer spacing when it fits in a 720px window', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom: 700,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('mt-2');
      expect(panel.className).toContain('p-2');
      expect(panel.className).not.toContain('mt-0');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('does not scroll the wide menu when compact spacing brings it back inside', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      const menu = this.id === 'signed-in-menu';
      const bottom = menu ? (this.className.includes('mt-0') ? 700 : 760) : 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('mt-0');
      expect(panel.className).toContain('px-2');
      expect(panel.className).toContain('py-0');
      expect(panel.className).not.toContain('overflow-y-auto');
      expect(panel.className).not.toContain('min-h-8');
      expect(panel.style.transform).toBe('');
      expect(panel.querySelector('a')?.className).toContain('min-h-11');
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expect(panel.className).toContain('hidden');
      expect(panel.className).not.toContain('mt-0');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('lifts a compact wide menu that still passes a 720px window and does not scroll', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      const menu = this.id === 'signed-in-menu';
      const lifted = /^translateY\(-(\d+)px\)$/.exec(menu ? this.style.transform : '');
      const lift = lifted === null ? 0 : Number(lifted[1]);
      const compact = menu && this.className.includes('mt-0');
      const naturalTop = compact ? 72 : 80;
      const naturalBottom = compact ? 754 : 794;
      return {
        x: 0,
        y: naturalTop - lift,
        top: menu ? naturalTop - lift : 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom: menu ? naturalBottom - lift : 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      const current = useAuthStore.getState().account;
      if (current === null) {
        throw new Error('expected account');
      }
      useAuthStore.setState({ account: { ...current, role: 'moderator' } });
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).not.toContain('mt-0');
      expect(panel.className).toContain('px-2');
      expect(panel.className).toContain('py-0');
      expect(panel.className).not.toContain('overflow-y-auto');
      expect(panel.className).not.toContain('min-h-8');
      expect(panel.className).toContain('fixed');
      expect(panel.className).not.toContain('absolute');
      expect(panel.style.top).toBe('39px');
      expect(panel.style.transform).toBe('');
      expect(panel.querySelector('a')?.className).toContain('min-h-11');
      expect(panel.querySelector('p')?.className).not.toContain('py-2');
      expect(screen.getByRole('button', { name: 'Menu' }).className).toContain('relative');
      expect(screen.getByRole('button', { name: 'Menu' }).className).toContain('z-[60]');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('keeps a lifted wide menu on the trigger when the frame moves', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    let anchorRight = 388;
    let fixedWidth = 288;
    let fixedTop = 39;
    const fixedBottom = 721;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      const menu = this.id === 'signed-in-menu';
      const fixed = menu && this.classList.contains('fixed');
      const compact = menu && this.className.includes('mt-0');
      const naturalTop = compact ? 72 : 80;
      const naturalBottom = compact ? 754 : 794;
      const top = fixed ? fixedTop : menu ? naturalTop : 0;
      const bottom = fixed ? fixedBottom : menu ? naturalBottom : 0;
      // The fixed panel reports its own inline box, which stays put when the
      // trigger parent moves. The parent is every other element in this test.
      const width = fixed ? fixedWidth : menu ? 288 : 40;
      const left = fixed
        ? Number.parseFloat(this.style.left) || anchorRight - width
        : menu
          ? anchorRight - 288
          : anchorRight - width;
      return {
        x: left,
        y: top,
        top,
        left,
        right: left + width,
        width,
        height: bottom - top,
        bottom,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      const current = useAuthStore.getState().account;
      if (current === null) {
        throw new Error('expected account');
      }
      useAuthStore.setState({ account: { ...current, role: 'moderator' } });
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('fixed');
      expect(panel.style.top).toBe('39px');
      expect(panel.style.left).toBe('100px');
      expect(panel.style.width).toBe('288px');
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.style.top).toBe('39px');
      expect(panel.style.left).toBe('100px');
      expect(panel.style.width).toBe('288px');
      fixedWidth = 200;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.style.width).toBe('200px');
      expect(panel.style.left).toBe('188px');
      fixedWidth = 288;
      anchorRight = 300;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.style.left).toBe('12px');
      expect(panel.style.width).toBe('288px');
      fixedTop = 50;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.style.top).toBe('50px');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('clears a lifted wide menu when Menu closes it', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      const menu = this.id === 'signed-in-menu';
      const lifted = /^translateY\(-(\d+)px\)$/.exec(menu ? this.style.transform : '');
      const lift = lifted === null ? 0 : Number(lifted[1]);
      const compact = menu && this.className.includes('mt-0');
      const naturalTop = compact ? 72 : 80;
      const naturalBottom = compact ? 754 : 794;
      return {
        x: 0,
        y: naturalTop - lift,
        top: menu ? naturalTop - lift : 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom: menu ? naturalBottom - lift : 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      const current = useAuthStore.getState().account;
      if (current === null) {
        throw new Error('expected account');
      }
      useAuthStore.setState({ account: { ...current, role: 'moderator' } });
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('fixed');
      expect(panel.style.top).toBe('39px');
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expectMenuClosed();
      expect(panel.className).not.toContain('fixed');
      expect(panel.style.top).toBe('');
      expect(panel.className).toContain('mt-2');
      expect(panel.className).not.toContain('mt-0');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('does not measure a wide menu that has left the document', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      const menu = this.id === 'signed-in-menu';
      const lifted = /^translateY\(-(\d+)px\)$/.exec(menu ? this.style.transform : '');
      const lift = lifted === null ? 0 : Number(lifted[1]);
      const compact = menu && this.className.includes('mt-0');
      const naturalTop = compact ? 72 : 80;
      const naturalBottom = compact ? 754 : 794;
      return {
        x: 0,
        y: naturalTop - lift,
        top: menu ? naturalTop - lift : 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom: menu ? naturalBottom - lift : 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      const current = useAuthStore.getState().account;
      if (current === null) {
        throw new Error('expected account');
      }
      useAuthStore.setState({ account: { ...current, role: 'moderator' } });
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      const parent = panel.parentElement;
      expect(panel.style.top).toBe('39px');
      panel.remove();
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 2000 });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.style.top).toBe('39px');
      if (parent !== null) {
        parent.appendChild(panel);
      }
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('does not lift a wide menu past the top of the window', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      const menu = this.id === 'signed-in-menu';
      const lifted = /^translateY\(-(\d+)px\)$/.exec(menu ? this.style.transform : '');
      const lift = lifted === null ? 0 : Number(lifted[1]);
      const naturalTop = 10;
      const naturalBottom = menu ? 754 : 0;
      return {
        x: 0,
        y: naturalTop - lift,
        top: menu ? naturalTop - lift : 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom: naturalBottom - lift,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(panel.className).not.toContain('fixed');
      expect(panel.className).not.toContain('overflow-y-auto');
      expect(panel.style.top).toBe('');
      expect(panel.querySelector('a')?.className).toContain('min-h-11');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('drops the wide menu outer spacing when a resize leaves it sticking out of the window', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    const bottom = 700;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('mt-2');
      expect(panel.className).toContain('p-2');
      expect(panel.className).not.toContain('mt-0');
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(panel.className).not.toContain('overflow-y-auto');
      expect(panel.className).not.toContain('min-h-8');
      expect(panel.className).not.toContain('max-h-');
      expect(panel.querySelector('a')?.className).toContain('min-h-11');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('restores the wide menu outer spacing when a resize leaves 48px of room and does not flutter', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    const bottom = 751;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.className).toContain('mt-2');
      expect(panel.className).toContain('p-2');
      expect(panel.className).not.toContain('mt-0');
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.className).toContain('mt-2');
      expect(panel.className).toContain('p-2');
      expect(panel.className).not.toContain('mt-0');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('keeps the compact wide menu when a resize leaves less than 48px of room', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    const bottom = 751;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 780 });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(panel.className).toContain('mt-0');
      expect(panel.className).not.toContain('mt-2');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
    }
  });

  it('drops the wide menu outer spacing when ResizeObserver reports the panel grew', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    const previousObserver = globalThis.ResizeObserver;
    let bottom = 700;
    let observedCallback: ResizeObserverCallback | undefined;
    let disconnected = false;
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observedCallback = callback;
      }

      observe(): void {}

      unobserve(): void {}

      disconnect(): void {
        disconnected = true;
      }
    }
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('mt-2');
      expect(panel.className).toContain('p-2');
      expect(panel.className).not.toContain('mt-0');
      bottom = 751;
      const callback = observedCallback;
      if (callback === undefined) {
        throw new Error('missing ResizeObserver callback');
      }
      act(() => {
        callback([], {} as ResizeObserver);
      });
      expect(panel.className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(panel.className).not.toContain('overflow-y-auto');
      cleanup();
      expect(disconnected).toBe(true);
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
      globalThis.ResizeObserver = previousObserver;
    }
  });

  it('drops the wide menu outer spacing when ResizeObserver is missing', () => {
    const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const previousRect = HTMLElement.prototype.getBoundingClientRect;
    const previousObserver = globalThis.ResizeObserver;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        bottom: 751,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    try {
      renderWithLocale(<SignedInChrome />);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = menuPanel();
      expect(panel.className).toContain('w-full');
      expect(document.documentElement.dataset['menuSheet']).toBe('1');
      expect(panel.className).not.toContain('overflow-y-auto');
    } finally {
      if (previousInnerHeight === undefined) {
        delete (window as { innerHeight?: number }).innerHeight;
      } else {
        Object.defineProperty(window, 'innerHeight', previousInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = previousRect;
      globalThis.ResizeObserver = previousObserver;
    }
  });
});
