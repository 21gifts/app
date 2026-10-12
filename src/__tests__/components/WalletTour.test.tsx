import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletTour } from '@/components/WalletTour';
import { useWallet, type UseWalletResult } from '@/hooks/useWallet';
import { markWalletIntroSeen } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('@/lib/api', () => ({ markWalletIntroSeen: vi.fn() }));
vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletIntroSeen: false,
};

const BOXES = {
  balance: { top: 12, bottom: 48, left: 200, right: 280 },
  receive: { top: 700, bottom: 756, left: 20, right: 180 },
  send: { top: 700, bottom: 756, left: 196, right: 356 },
  menu: { top: 8, bottom: 52, left: 290, right: 386 },
} as const;

type TargetName = keyof typeof BOXES;

/** Puts a target with a fixed box into the page. */
function addTarget(name: TargetName): HTMLElement {
  const element = document.createElement('button');
  if (name === 'menu') {
    element.id = 'signed-in-menu-button';
  } else {
    element.setAttribute('data-wallet-tour', name);
  }
  const box = BOXES[name];
  element.getBoundingClientRect = () =>
    ({
      ...box,
      width: box.right - box.left,
      height: box.bottom - box.top,
      x: box.left,
      y: box.top,
      toJSON: () => box,
    }) as DOMRect;
  document.body.appendChild(element);
  return element;
}

function wallet(status: UseWalletResult['status']): void {
  vi.mocked(useWallet).mockReturnValue({
    status,
    balanceSats: null,
    retry: vi.fn(),
    setupFailed: false,
  });
}

beforeEach(() => {
  vi.mocked(logInteraction).mockReset();
  wallet('ready');
  vi.mocked(markWalletIntroSeen)
    .mockReset()
    .mockResolvedValue({ ...account, walletIntroSeen: true });
  useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
});

function card(): HTMLElement {
  return screen.getByRole('dialog');
}

describe('WalletTour', () => {
  it('walks the four steps in place and ends with Got it, which marks the tour seen', () => {
    (['balance', 'receive', 'send', 'menu'] as const).forEach(addTarget);
    renderWithLocale(<WalletTour blocked={false} />);
    expect(card().getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('1 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '21.gifts is now your wallet' })).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Next');
    // The balance sits in the upper half: the card goes under its ring.
    const ring = document.querySelector('[aria-hidden="true"].ring-white') as HTMLElement;
    expect(ring.style.top).toBe('4px');
    expect(ring.style.bottom).toBe('744px');
    expect(ring.style.left).toBe('192px');
    expect(ring.style.width).toBe('96px');
    expect(card().style.top).toBe('68px');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Receive' })).toBeTruthy();
    // Receive sits in the lower half: the card goes above it.
    expect(card().style.bottom).toBe('120px');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Send' })).toBeTruthy();
    expect(
      screen.getByText(
        'Pay people and shops: scan a QR code or paste an address. Sending to other members is free.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('4 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Everything else' })).toBeTruthy();
    const menuRing = document.querySelector('[aria-hidden="true"].ring-white') as HTMLElement;
    // Clamped to the window on the right.
    expect(menuRing.style.left).toBe('282px');
    expect(menuRing.style.width).toBe('108px');

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useAuthStore.getState().account?.walletIntroSeen).toBe(true);
    expect(markWalletIntroSeen).toHaveBeenCalledWith('sess');
    expect(vi.mocked(logInteraction).mock.calls).toEqual([
      ['wallet_tour_shown', { steps: 4 }],
      ['wallet_tour_step', { step: 1, target: 'balance' }],
      ['wallet_tour_step', { step: 2, target: 'receive' }],
      ['wallet_tour_step', { step: 3, target: 'send' }],
      ['wallet_tour_step', { step: 4, target: 'menu' }],
      ['wallet_tour_done', { outcome: 'completed', step: 4 }],
    ]);
  });

  it('reports each event once under StrictMode, also across a resize and a resume behind a dialog', async () => {
    (['balance', 'receive', 'send', 'menu'] as const).forEach(addTarget);
    renderWithLocale(
      <StrictMode>
        <WalletTour blocked={false} />
      </StrictMode>,
    );
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    const other = document.createElement('div');
    other.setAttribute('aria-modal', 'true');
    document.body.appendChild(other);
    await vi.waitFor(() => expect(screen.queryByText('1 of 4')).toBeNull());
    other.remove();
    await vi.waitFor(() => expect(screen.getByText('1 of 4')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(vi.mocked(logInteraction).mock.calls).toEqual([
      ['wallet_tour_shown', { steps: 4 }],
      ['wallet_tour_step', { step: 1, target: 'balance' }],
      ['wallet_tour_step', { step: 2, target: 'receive' }],
      ['wallet_tour_done', { outcome: 'skipped', step: 2 }],
    ]);
  });

  it('skips with Skip or Escape, and stays gone when the request fails', async () => {
    vi.mocked(markWalletIntroSeen).mockRejectedValue(new Error('offline'));
    addTarget('menu');
    renderWithLocale(<WalletTour blocked={false} />);
    expect(screen.getByText('1 of 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(useAuthStore.getState().account?.walletIntroSeen).toBe(true);

    cleanup();
    useAuthStore.setState({ account: { ...account, walletIntroSeen: false } });
    renderWithLocale(<WalletTour blocked={false} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markWalletIntroSeen).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(logInteraction).mock.calls.filter(([name]) => name === 'wallet_tour_done'),
    ).toEqual([
      ['wallet_tour_done', { outcome: 'skipped', step: 1 }],
      ['wallet_tour_done', { outcome: 'skipped', step: 1 }],
    ]);
  });

  it('treats a target that lies wholly outside the window as gone', async () => {
    addTarget('balance');
    const receive = addTarget('receive');
    addTarget('menu');
    renderWithLocale(<WalletTour blocked={false} />);
    expect(screen.getByText('1 of 3')).toBeTruthy();
    // Scrolled out to the right: no overlap with the 390 px wide window.
    receive.getBoundingClientRect = () =>
      ({ top: 700, bottom: 756, left: 400, right: 560, width: 160, height: 56 }) as DOMRect;
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await vi.waitFor(() => expect(screen.getByText('3 of 3')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Everything else' })).toBeTruthy();
    for (const box of [
      { top: 100, bottom: 140, left: -200, right: -10 },
      { top: -90, bottom: -10, left: 20, right: 180 },
      { top: 900, bottom: 950, left: 20, right: 180 },
    ]) {
      cleanup();
      document.body.innerHTML = '';
      useAuthStore.setState({ account: { ...account, walletIntroSeen: false } });
      const outside = addTarget('balance');
      outside.getBoundingClientRect = () =>
        ({ ...box, width: box.right - box.left, height: box.bottom - box.top }) as DOMRect;
      addTarget('menu');
      renderWithLocale(<WalletTour blocked={false} />);
      expect(screen.getByText('1 of 1')).toBeTruthy();
    }
  });

  it('leaves out a step whose target is missing or has no box at the start', () => {
    const hidden = document.createElement('a');
    hidden.setAttribute('data-wallet-tour', 'balance');
    document.body.appendChild(hidden);
    addTarget('receive');
    addTarget('send');
    addTarget('menu');
    renderWithLocale(<WalletTour blocked={false} />);
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Receive' })).toBeTruthy();
  });

  it('skips a target that is gone by its turn, and ends when none is left', async () => {
    addTarget('balance');
    const receive = addTarget('receive');
    const menu = addTarget('menu');
    renderWithLocale(<WalletTour blocked={false} />);
    receive.remove();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await vi.waitFor(() => expect(screen.getByText('3 of 3')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Everything else' })).toBeTruthy();
    menu.remove();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useAuthStore.getState().account?.walletIntroSeen).toBe(true);
    expect(vi.mocked(logInteraction)).toHaveBeenLastCalledWith('wallet_tour_done', {
      outcome: 'completed',
      step: 3,
    });
  });

  it('never reports a step as shown whose target is gone by its turn', async () => {
    addTarget('balance');
    const receive = addTarget('receive');
    addTarget('menu');
    renderWithLocale(<WalletTour blocked={false} />);
    receive.remove();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await vi.waitFor(() => expect(screen.getByText('3 of 3')).toBeTruthy());
    const steps = vi
      .mocked(logInteraction)
      .mock.calls.filter(([name]) => name === 'wallet_tour_step')
      .map(([, props]) => props);
    expect(steps).toEqual([
      { step: 1, target: 'balance' },
      { step: 3, target: 'menu' },
    ]);
  });

  it('follows its target when the page changes or scrolls', async () => {
    const balance = addTarget('balance');
    renderWithLocale(<WalletTour blocked={false} />);
    const ring = (): HTMLElement =>
      document.querySelector('[aria-hidden="true"].ring-white') as HTMLElement;
    expect(ring().style.top).toBe('4px');
    balance.getBoundingClientRect = () =>
      ({ top: 100, bottom: 140, left: 200, right: 280, width: 80, height: 40 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(ring().style.top).toBe('92px');
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(ring().style.top).toBe('92px');
  });

  it('waits behind another dialog or the open Menu and starts once it is gone', async () => {
    addTarget('balance');
    const menu = addTarget('menu');
    menu.setAttribute('aria-expanded', 'true');
    const other = document.createElement('div');
    other.setAttribute('aria-modal', 'true');
    document.body.appendChild(other);
    renderWithLocale(<WalletTour blocked={false} />);
    expect(screen.queryByText('1 of 2')).toBeNull();
    other.remove();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText('1 of 2')).toBeNull();
    menu.setAttribute('aria-expanded', 'false');
    await vi.waitFor(() => expect(screen.getByText('1 of 2')).toBeTruthy());
  });

  it('does not show while blocked, while the wallet connects, when seen, without the field, or signed out', () => {
    addTarget('menu');
    const { rerender } = renderWithLocale(<WalletTour blocked />);
    expect(screen.queryByRole('dialog')).toBeNull();
    wallet('connecting');
    rerender(<WalletTour blocked={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    wallet('error');
    act(() => {
      useAuthStore.setState({ account: { ...account, walletIntroSeen: true } });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    const { walletIntroSeen, ...older } = account;
    void walletIntroSeen;
    act(() => {
      useAuthStore.setState({ account: older });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      useAuthStore.setState({ session: null, account });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      useAuthStore.setState({ session: 'sess' });
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does not start without any target', () => {
    renderWithLocale(<WalletTour blocked={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markWalletIntroSeen).not.toHaveBeenCalled();
  });
});
