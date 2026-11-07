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
import { onIncomingPayment, receiveWalletInvoice } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('@/lib/move-funds', () => ({
  MOVE_FUNDS_EVENT: '21gifts:move-funds',
  takeMoveFundsRequest: vi.fn(),
}));
vi.mock('@/lib/wallet/wallet-service', () => ({
  onIncomingPayment: vi.fn(),
  receiveWalletInvoice: vi.fn(),
}));
vi.mock('@/components/ViewHistoryRoot', () => ({ useChromeBack: vi.fn() }));
vi.mock('@/lib/interaction-log', () => ({
  LOGOUT_EVENT: '21gifts:logout',
  logInteraction: vi.fn(),
}));

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
  vi.mocked(useWallet).mockReturnValue({
    status,
    balanceSats,
    retry: vi.fn(),
    setupFailed: false,
    downloading: false,
    retrying: false,
  });
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
  vi.mocked(receiveWalletInvoice).mockReset().mockResolvedValue('lnbc1pmove');
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
    account: { id: 'acc_1', name: 'Ada', username: 'ada', setup: null } as Account,
  });
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  useAuthStore.setState({ session: null, account: null });
});

/** A promise the test settles by hand. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/**
 * Records every `location.href` the sheet sets until the returned restore runs.
 *
 * @returns The recorded hrefs and a restore function.
 */
function recordHrefs(): { hrefs: string[]; restore: () => void } {
  const hrefs: string[] = [];
  const previous = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      hostname: previous.hostname,
      search: previous.search,
      pathname: previous.pathname,
      hash: previous.hash,
      get href(): string {
        return previous.href;
      },
      set href(value: string) {
        hrefs.push(value);
      },
    },
  });
  return {
    hrefs,
    restore: () => {
      Object.defineProperty(window, 'location', { configurable: true, value: previous });
    },
  };
}

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
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.slice(-3)).toEqual(['Open my other wallet', 'Copy my address', 'I sent it']);
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
    expect(screen.queryByRole('button', { name: 'Open my other wallet' })).toBeNull();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('leaves a request stored during onboarding and opens it once the member has a username', () => {
    useAuthStore.setState({
      account: { id: 'acc_1', name: 'Ada', username: null, setup: 'username' } as Account,
    });
    vi.mocked(takeMoveFundsRequest).mockReturnValue('link');
    renderWithLocale(<MoveFundsSheet />);
    act(() => {
      window.dispatchEvent(new Event(MOVE_FUNDS_EVENT));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(takeMoveFundsRequest).not.toHaveBeenCalled();
    act(() => {
      useAuthStore.setState({
        account: { id: 'acc_1', name: 'Ada', username: 'ada', setup: 'rules' } as Account,
      });
    });
    expect(takeMoveFundsRequest).not.toHaveBeenCalled();
    act(() => {
      useAuthStore.setState({
        account: { id: 'acc_1', name: 'Ada', username: 'ada', setup: null } as Account,
      });
    });
    expect(screen.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeTruthy();
    expect(events()).toEqual([['wallet_move_opened', { source: 'link' }]]);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: 'Copy my address' })).toBeTruthy();
  });

  it('keeps an open flow without an address when the username goes away', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      useAuthStore.setState({
        account: { id: 'acc_1', name: 'Ada', username: null, setup: null } as Account,
      });
    });
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
    expect(done.textContent).toContain("₿12'000");
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
        account: { id: 'acc_1', name: 'Ada', username: 'ada', setup: null } as Account,
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
        account: { id: 'acc_2', name: 'Bo', username: 'bo', setup: null } as Account,
      });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drops a request stored during onboarding when that member signs out', () => {
    useAuthStore.setState({
      account: { id: 'acc_1', name: 'Ada', username: null, setup: 'username' } as Account,
    });
    renderWithLocale(<MoveFundsSheet />);
    act(() => {
      window.dispatchEvent(new Event(MOVE_FUNDS_EVENT));
    });
    expect(takeMoveFundsRequest).not.toHaveBeenCalled();
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    // Taken and thrown away: nothing opens, nothing is reported.
    expect(takeMoveFundsRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events()).toEqual([]);
    act(() => {
      useAuthStore.setState({
        session: 'tok2',
        account: { id: 'acc_2', name: 'Bo', username: 'bo', setup: null } as Account,
      });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a request a visitor followed before any sign-in', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<MoveFundsSheet />);
    act(() => {
      window.dispatchEvent(new Event(MOVE_FUNDS_EVENT));
    });
    expect(takeMoveFundsRequest).not.toHaveBeenCalled();
  });

  it('reports the close once when Log out ends an open flow, under the ending session', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vi.mocked(logInteraction).mockClear();
    act(() => {
      window.dispatchEvent(new Event('21gifts:logout'));
    });
    expect(events()).toEqual([['wallet_move_closed', { step: 'go' }]]);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    expect(events()).toHaveLength(1);
  });

  it('reports no close when Log out comes after the payment arrived', () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      emit(received(500));
    });
    vi.mocked(logInteraction).mockClear();
    act(() => {
      window.dispatchEvent(new Event('21gifts:logout'));
    });
    expect(events()).toEqual([]);
    expect(screen.getByRole('dialog', { name: '₿500 arrived' })).toBeTruthy();
  });

  it('tells the chrome whether it is open, and that it closed when it unmounts', () => {
    const onOpenChange = vi.fn();
    const { unmount } = renderWithLocale(<MoveFundsSheet onOpenChange={onOpenChange} />);
    expect(onOpenChange.mock.calls).toEqual([[false]]);
    openByRequest();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    openByRequest();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    unmount();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
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
        account: { id: 'acc_2', name: 'Bo', username: 'bo', setup: null } as Account,
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

  it('opens the other wallet on a phone with a fresh invoice on tap, then waits for the payment', async () => {
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(receiveWalletInvoice).not.toHaveBeenCalled();
    const mint = deferred<string>();
    vi.mocked(receiveWalletInvoice).mockReturnValueOnce(mint.promise);
    const { hrefs, restore } = recordHrefs();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
      expect(receiveWalletInvoice).toHaveBeenCalledWith('Transfer to your 21.gifts account');
      const opening = screen.getByRole('button', { name: 'Open my other wallet' });
      expect((opening as HTMLButtonElement).disabled).toBe(true);
      expect(opening.querySelector('svg')).not.toBeNull();
      await act(async () => {
        mint.resolve('lnbc1pmove');
        await mint.promise;
      });
    } finally {
      restore();
    }
    expect(hrefs).toEqual(['lightning:lnbc1pmove']);
    expect(screen.getByRole('dialog', { name: 'Waiting for your Bitcoin…' })).toBeTruthy();
    expect(events().slice(-1)).toEqual([['wallet_move_step', { step: 'waiting' }]]);
    act(() => {
      emit(received(12_000));
    });
    expect(screen.getByRole('dialog', { name: "₿12'000 arrived" })).toBeTruthy();
    act(() => {
      override?.onClick();
    });
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const again = screen.getByRole('button', { name: 'Open my other wallet' });
    expect((again as HTMLButtonElement).disabled).toBe(false);
    expect(again.querySelector('svg')).toBeNull();
  });

  it('says so with Try again when the wallet cannot make the invoice, and keeps the copy fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.mocked(receiveWalletInvoice).mockRejectedValueOnce(new Error('wallet-connect'));
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const { hrefs, restore } = recordHrefs();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
        await Promise.resolve();
      });
      expect(screen.getByRole('alert').textContent).toBe(
        'Your 21.gifts wallet could not create a payment request. Try again, or copy your address.',
      );
      expect(screen.queryByRole('button', { name: 'Open my other wallet' })).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Send to your 21.gifts address' })).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy my address' }));
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
      expect(hrefs).toEqual([]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await Promise.resolve();
      });
    } finally {
      restore();
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    expect(receiveWalletInvoice).toHaveBeenCalledTimes(2);
    expect(hrefs).toEqual(['lightning:lnbc1pmove']);
    expect(screen.getByRole('dialog', { name: 'Waiting for your Bitcoin…' })).toBeTruthy();
    act(() => {
      override?.onClick();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open my other wallet' })).toBeTruthy();
  });

  it('ignores an invoice or a failure that answers after the member left the step', async () => {
    const late = deferred<string>();
    const lateFailure = deferred<string>();
    vi.mocked(receiveWalletInvoice)
      .mockReturnValueOnce(late.promise)
      .mockReturnValueOnce(lateFailure.promise);
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const { hrefs, restore } = recordHrefs();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
      act(() => {
        override?.onClick();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      // Back on step 2 with a new run: the first answer is stale.
      fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await act(async () => {
        late.resolve('lnbc1plate');
        lateFailure.reject(new Error('late'));
        await Promise.allSettled([late.promise, lateFailure.promise]);
      });
    } finally {
      restore();
    }
    expect(hrefs).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events().filter(([name]) => name === 'wallet_move_step')).toEqual([
      ['wallet_move_step', { step: 'go' }],
      ['wallet_move_step', { step: 'go' }],
    ]);
  });

  it('ignores an answer that arrives once the payment already moved the flow on', async () => {
    const late = deferred<string>();
    vi.mocked(receiveWalletInvoice).mockReturnValueOnce(late.promise);
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const { hrefs, restore } = recordHrefs();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
      act(() => {
        emit(received(500));
      });
      await act(async () => {
        late.resolve('lnbc1plate');
        await late.promise;
      });
    } finally {
      restore();
    }
    expect(hrefs).toEqual([]);
    expect(screen.getByRole('dialog', { name: '₿500 arrived' })).toBeTruthy();
  });

  it('ignores an invoice that answers in the same tick as a Log out, before the sheet renders again', async () => {
    const late = deferred<string>();
    vi.mocked(receiveWalletInvoice).mockReturnValueOnce(late.promise);
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const { hrefs, restore } = recordHrefs();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
      await act(async () => {
        window.dispatchEvent(new Event('21gifts:logout'));
        late.resolve('lnbc1plate');
        await late.promise;
      });
    } finally {
      restore();
    }
    expect(hrefs).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events().filter(([name]) => name === 'wallet_move_step')).toEqual([
      ['wallet_move_step', { step: 'go' }],
    ]);
  });

  it('hands over the fixture invoice under the move-invoice pin in a Playwright build only', async () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=move-invoice');
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    let recorded = recordHrefs();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
        await Promise.resolve();
      });
    } finally {
      recorded.restore();
    }
    expect(recorded.hrefs).toEqual(['lightning:lnbc1pmovefundsvisual']);
    expect(receiveWalletInvoice).not.toHaveBeenCalled();
    cleanup();
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    recorded = recordHrefs();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
        await Promise.resolve();
      });
    } finally {
      recorded.restore();
    }
    expect(recorded.hrefs).toEqual(['lightning:lnbc1pmove']);
    expect(receiveWalletInvoice).toHaveBeenCalledTimes(1);
  });

  it('keeps minting under the move-minting pin in a Playwright build only', async () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=move-minting');
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
      await Promise.resolve();
    });
    const minting = screen.getByRole('button', { name: 'Open my other wallet' });
    expect((minting as HTMLButtonElement).disabled).toBe(true);
    expect(minting.querySelector('svg')).not.toBeNull();
    expect(receiveWalletInvoice).not.toHaveBeenCalled();
    cleanup();
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    renderWithLocale(<MoveFundsSheet />);
    openByRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const { restore } = recordHrefs();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Open my other wallet' }));
        await Promise.resolve();
      });
    } finally {
      restore();
    }
    expect(receiveWalletInvoice).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Waiting for your Bitcoin…' })).toBeTruthy();
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
