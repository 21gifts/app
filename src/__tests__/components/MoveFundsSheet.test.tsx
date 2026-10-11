import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveFundsSheet } from '@/components/MoveFundsSheet';
import { useChromeBack, type ChromeBackOverride } from '@/components/ViewHistoryRoot';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWallet, type UseWalletResult } from '@/hooks/useWallet';
import type { Account } from '@/lib/api-types';
import { logInteraction } from '@/lib/interaction-log';
import { MOVE_FUNDS_EVENT, takeMoveFundsRequest, type MoveFundsSource } from '@/lib/move-funds';
import type { FiatRateDay } from '@/lib/stats-money';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { onIncomingPayment } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('@/lib/move-funds', () => ({
  MOVE_FUNDS_EVENT: '21gifts:move-funds',
  takeMoveFundsRequest: vi.fn(),
}));
vi.mock('@/lib/wallet/wallet-service', () => ({ onIncomingPayment: vi.fn() }));
vi.mock('@/components/ViewHistoryRoot', () => ({ useChromeBack: vi.fn() }));
vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
let override: ChromeBackOverride | null = null;
let emit: (payment: WalletPayment) => void = () => undefined;
const unsubscribe = vi.fn();

function wallet(status: UseWalletResult['status'], balanceSats: number | null): void {
  vi.mocked(useWallet).mockReturnValue({ status, balanceSats, retry: vi.fn(), setupFailed: false });
}

function userAgent(value: string): void {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value });
}

function received(amountSats: number): WalletPayment {
  return {
    id: 'p1',
    direction: 'received',
    amountSats,
    feesSats: 0,
    timestamp: 1,
    status: 'completed',
    method: 'lightning',
    senderComment: null,
    info: {},
  };
}

beforeEach(() => {
  override = null;
  vi.mocked(useChromeBack).mockReturnValue({
    override: null,
    stepBack: null,
    setOverride: (next) => {
      override = next;
    },
  });
  vi.mocked(useSpotRate).mockReset().mockReturnValue(RATE_DAY);
  vi.mocked(takeMoveFundsRequest).mockReset().mockReturnValue(null);
  vi.mocked(logInteraction).mockReset();
  unsubscribe.mockReset();
  vi.mocked(onIncomingPayment)
    .mockReset()
    .mockImplementation((listener) => {
      emit = listener;
      return unsubscribe;
    });
  wallet('ready', 21_000);
  userAgent(IPHONE);
  useAuthStore.setState({
    session: 'tok',
    account: { id: 'acc_1', name: 'Ada', username: 'ada' } as Account,
  });
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  useAuthStore.setState({ session: null, account: null });
});

function events(): unknown[][] {
  return vi.mocked(logInteraction).mock.calls;
}

function openByRequest(source: MoveFundsSource = 'receive'): void {
  vi.mocked(takeMoveFundsRequest).mockReturnValueOnce(source);
  act(() => {
    window.dispatchEvent(new Event(MOVE_FUNDS_EVENT));
  });
}

describe('MoveFundsSheet', () => {
  it('stays closed without a request, and registers no arrow', () => {
    const { container } = renderWithLocale(<MoveFundsSheet />);
    expect(container.firstChild).toBeNull();
    window.dispatchEvent(new Event(MOVE_FUNDS_EVENT));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(override).toBeNull();
    expect(useSpotRate).toHaveBeenCalledWith(false);
  });

  it('opens on a waiting ?move=1 request at mount and removes the parameter', () => {
    window.history.replaceState({ keep: 1 }, '', '/wallet?move=1&visual=x#top');
    vi.mocked(takeMoveFundsRequest).mockReturnValueOnce('link');
    renderWithLocale(<MoveFundsSheet />);
    expect(screen.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeTruthy();
    expect(events()).toEqual([['wallet_move_opened', { source: 'link' }]]);
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/wallet?visual=x#top',
    );
    expect(window.history.state).toEqual({ keep: 1 });
  });

  it('walks the steps on a phone without a QR, and the arrow steps back and closes', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    expect(window.location.search).toBe('');
    expect(override?.over).toBe(true);
    expect(screen.getByText('1. Copy your 21.gifts address.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('dialog', { name: 'Send to your 21.gifts address' })).toBeTruthy();
    expect(screen.getByText('ada@21.gifts')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /QR/i })).toBeNull();
    expect(screen.queryByText(/scan this code/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'I sent it' }));
    expect(screen.getByRole('dialog', { name: 'Waiting for your Bitcoin…' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
    act(() => {
      override?.onClick();
    });
    expect(screen.getByRole('dialog', { name: 'Send to your 21.gifts address' })).toBeTruthy();
    act(() => {
      override?.onClick();
    });
    expect(screen.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeTruthy();
    act(() => {
      override?.onClick();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(override).toBeNull();
    expect(events()).toEqual([
      ['wallet_move_opened', { source: 'receive' }],
      ['wallet_move_step', { step: 'go' }],
      ['wallet_move_step', { step: 'waiting' }],
      ['wallet_move_step', { step: 'go' }],
      ['wallet_move_closed', { step: 'intro' }],
    ]);
  });

  it('shows the Receive QR and the scan hint on a desktop, and copies the address', async () => {
    userAgent(DESKTOP);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('img', { name: /QR/i })).toBeTruthy();
    expect(
      screen.getByText('Open your other wallet on your phone, tap Send and scan this code'),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy my address' }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(events()).toContainEqual(['wallet_move_copied', { step: 'go' }]);
    writeText.mockRejectedValueOnce(new Error('denied'));
    vi.mocked(logInteraction).mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
      await Promise.resolve();
    });
    expect(events()).toEqual([]);
    expect(document.querySelector('a[href^="lightning:"]')).toBeNull();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('shows no address without a username', () => {
    useAuthStore.setState({ account: { id: 'acc_1', name: 'Ada', username: null } as Account });
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.queryByRole('button', { name: 'Copy my address' })).toBeNull();
    expect(screen.getByRole('button', { name: 'I sent it' })).toBeTruthy();
  });

  it('moves to arrived by itself when a payment completes while waiting, then Done closes', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    expect(onIncomingPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'I sent it' }));
    act(() => {
      emit(received(12_000));
    });
    const done = screen.getByRole('dialog', { name: "₿12'000 arrived" });
    expect(done.textContent).toContain('$12.00');
    expect(done.textContent).toContain(
      "Your wallet now holds ₿21'000 · $21.00. Something left over there? You can do this again any time from Receive.",
    );
    expect(unsubscribe).toHaveBeenCalled();
    expect(events().slice(-2)).toEqual([
      ['wallet_move_step', { step: 'done' }],
      ['wallet_move_done', { amountSats: 12_000 }],
    ]);
    vi.mocked(logInteraction).mockClear();
    act(() => {
      override?.onClick();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events()).toEqual([]);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      emit(received(500));
    });
    vi.mocked(logInteraction).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events()).toEqual([]);
  });

  it('leaves out the fiat without a rate and the balance while it is unknown', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      emit(received(500));
    });
    const done = screen.getByRole('dialog', { name: '₿500 arrived' });
    expect(done.textContent).toContain("Your wallet now holds ₿21'000.");
    expect(done.textContent).not.toContain('$');
    cleanup();
    wallet('connecting', null);
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      emit(received(500));
    });
    expect(screen.getByRole('dialog').textContent).not.toContain('now holds');
  });

  it('leaves a request waiting while signed out, takes it once signed in, and hides on sign-out', () => {
    useAuthStore.setState({ session: null, account: null });
    vi.mocked(takeMoveFundsRequest).mockReturnValue('link');
    renderWithLocale(<MoveFundsSheet />);
    act(() => {
      window.dispatchEvent(new Event(MOVE_FUNDS_EVENT));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(takeMoveFundsRequest).not.toHaveBeenCalled();
    act(() => {
      useAuthStore.setState({
        session: 'tok',
        account: { id: 'acc_1', name: 'Ada', username: 'ada' } as Account,
      });
    });
    expect(screen.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeTruthy();
    expect(events()).toEqual([['wallet_move_opened', { source: 'link' }]]);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.mocked(takeMoveFundsRequest).mockReturnValue(null);
    act(() => {
      useAuthStore.setState({
        session: 'tok2',
        account: { id: 'acc_2', name: 'Bo', username: 'bo' } as Account,
      });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stops listening for a payment as soon as the member signs out', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onIncomingPayment).toHaveBeenCalledTimes(1);
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    expect(unsubscribe).toHaveBeenCalled();
    vi.mocked(logInteraction).mockClear();
    act(() => {
      useAuthStore.setState({
        session: 'tok2',
        account: { id: 'acc_2', name: 'Bo', username: 'bo' } as Account,
      });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events()).toEqual([]);
  });

  it('closes with X and with Escape, and ignores other keys', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    expect(screen.queryByText('Close')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    openByRequest();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events().filter(([name]) => name === 'wallet_move_closed')).toEqual([
      ['wallet_move_closed', { step: 'intro' }],
      ['wallet_move_closed', { step: 'intro' }],
    ]);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      emit(received(500));
    });
    vi.mocked(logInteraction).mockClear();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events()).toEqual([]);
  });

  it('reports where it was closed before the end: go and waiting, with X and with Escape', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'I sent it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'I sent it' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(events().filter(([name]) => name === 'wallet_move_closed')).toEqual([
      ['wallet_move_closed', { step: 'go' }],
      ['wallet_move_closed', { step: 'go' }],
      ['wallet_move_closed', { step: 'waiting' }],
      ['wallet_move_closed', { step: 'waiting' }],
    ]);
  });

  it('reports the opening once under StrictMode', () => {
    vi.mocked(takeMoveFundsRequest).mockReturnValueOnce('link');
    renderWithLocale(
      <StrictMode>
        <MoveFundsSheet />
      </StrictMode>,
    );
    expect(screen.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeTruthy();
    expect(events()).toEqual([['wallet_move_opened', { source: 'link' }]]);
  });

  it('opens on the arrived step under the move-arrived pin in a Playwright build only', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=move-arrived');
    renderWithLocale(<MoveFundsSheet />);
    expect(screen.getByRole('dialog', { name: '₿500 arrived' })).toBeTruthy();
    expect(takeMoveFundsRequest).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
    cleanup();
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    renderWithLocale(<MoveFundsSheet />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
