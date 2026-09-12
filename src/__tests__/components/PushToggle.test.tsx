import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushToggle } from '@/components/PushToggle';
import { disablePush, enablePush, isIosSafari, isStandaloneDisplay } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/push', () => ({
  enablePush: vi.fn().mockResolvedValue(undefined),
  disablePush: vi.fn().mockResolvedValue(undefined),
  isIosSafari: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
}));

const VIEW_KEY = 'a'.repeat(64);

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
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: 1_700_000_001,
      viewKey: VIEW_KEY,
      setup: null,
      missing: [],
    },
  });
  vi.mocked(isIosSafari).mockReturnValue(false);
  vi.mocked(isStandaloneDisplay).mockReturnValue(false);
  vi.mocked(enablePush).mockResolvedValue(undefined);
  vi.mocked(disablePush).mockResolvedValue(undefined);
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

  it('renders nothing when service worker or PushManager is missing', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    renderWithLocale(<PushToggle />);
    await waitFor(() => {
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  it('shows an icon-only enable control when not subscribed', async () => {
    renderWithLocale(<PushToggle />);
    const button = await screen.findByRole('button', { name: 'Enable notifications' });
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.queryByText('Enable notifications')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).toContain('border-app-border-strong');
    expect(button.className).not.toContain('bg-app-btn');
    expect(button.querySelector('svg')).not.toBeNull();
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
    expect(screen.getByText('On')).toBeTruthy();
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
    expect(screen.getByText('On')).toBeTruthy();
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
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.queryByText('On')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).not.toContain('bg-app-btn');
  });

  it('shows unavailable copy when enable fails', async () => {
    vi.mocked(enablePush).mockRejectedValue(new Error('Notification permission denied'));
    renderWithLocale(<PushToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    expect(
      await screen.findByText('Notifications are not available in this browser.'),
    ).toBeTruthy();
  });
});
