import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletScreenView } from '@/components/WalletScreenView';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { UseWalletResult } from '@/hooks/useWallet';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';
import { WALLET_VISUAL_FIXTURE_MNEMONIC } from '@/hooks/useWalletPhrase';
import type { FiatRateDay } from '@/lib/stats-money';
import { resetViewHistory } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useLatestRateDay', () => ({
  useLatestRateDay: vi.fn(),
}));

vi.mock('@/components/QrScanner', () => ({
  QrScanner: () => <p>Camera stub</p>,
}));

vi.mock('@/components/WalletHistory', () => ({
  WalletHistory: () => <section aria-label="Payments history stub" />,
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

beforeEach(() => {
  vi.mocked(useLatestRateDay).mockReset().mockReturnValue(RATE_DAY);
});

afterEach(() => {
  cleanup();
  resetViewHistory();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useAuthStore.setState({ session: null, account: null });
});

const words = WALLET_VISUAL_FIXTURE_MNEMONIC.split(' ');

function walletResult(status: UseWalletResult['status']): UseWalletResult {
  return {
    status,
    balanceSats: status === 'ready' ? 21_000 : null,
    unlock: vi.fn(),
    retry: vi.fn(),
  };
}

function setWalletAccount(): void {
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_wallet',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      username: 'ada',
      location: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: 1,
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: null,
      missing: [],
      passkeyCredentialId: 'credential',
    },
  });
}

const ENTRY_PROPS = {
  view: 'reveal' as const,
  status: 'idle' as const,
  error: null,
  words: [],
  activate: vi.fn(),
  showPhrase: vi.fn(),
  hidePhrase: vi.fn(),
  retry: vi.fn(),
};

/**
 * Whether `later` comes after `earlier` in document order.
 *
 * @param earlier - First node.
 * @param later - Second node.
 * @returns `true` when `later` follows `earlier`.
 */
function follows(earlier: Node, later: Node): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Presses the top-left Back arrow.
 */
function pressBack(): void {
  fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
}

describe('WalletScreenView', () => {
  it('renders the wallet heading', () => {
    renderWithLocale(
      <WalletScreenView
        view="activate"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Wallet' })).toBeTruthy();
  });

  it.each([
    ['locked', 'Unlock your wallet to see your Bitcoin balance.'],
    ['connecting', 'Opening your wallet…'],
    ['ready', "₿21'000$21.00"],
    ['error', 'Your wallet could not be opened. Please try again.'],
  ] as const)(
    'renders the %s balance in the central spot above Send and Receive',
    (status, text) => {
      setWalletAccount();
      renderWithLocale(<WalletScreenView {...ENTRY_PROPS} wallet={walletResult(status)} />);
      const heading = screen.getByRole('heading', { name: 'Wallet' });
      expect(heading.className).toContain('sr-only');
      const balance = screen.getByRole('region', { name: 'Balance' });
      expect(balance.textContent).toContain(text);
      expect(balance.parentElement?.className).toContain('min-h-48');
      expect(follows(heading, balance)).toBe(true);
      expect(follows(balance, screen.getByRole('button', { name: 'Send' }))).toBe(true);
      expect(follows(balance, screen.getByRole('button', { name: 'Receive' }))).toBe(true);
      expect(screen.queryByText('ada@21.gifts')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    },
  );

  it("keeps today's entry markup when the wallet is disabled or omitted", () => {
    const props = {
      view: 'activate' as const,
      status: 'idle' as const,
      error: null,
      words: [],
      activate: vi.fn(),
      showPhrase: vi.fn(),
      hidePhrase: vi.fn(),
      retry: vi.fn(),
    };
    const omitted = renderWithLocale(<WalletScreenView {...props} />);
    const originalMarkup = omitted.container.innerHTML;
    omitted.unmount();
    const disabled = renderWithLocale(
      <WalletScreenView {...props} wallet={walletResult('disabled')} />,
    );
    expect(disabled.container.innerHTML).toBe(originalMarkup);
  });

  it('shows the payment list only while the wallet is ready, between balance and Send', () => {
    setWalletAccount();
    for (const status of ['disabled', 'locked', 'connecting', 'error'] as const) {
      const view = renderWithLocale(
        <WalletScreenView {...ENTRY_PROPS} wallet={walletResult(status)} />,
      );
      expect(screen.queryByRole('region', { name: 'Payments history stub' })).toBeNull();
      view.unmount();
    }
    renderWithLocale(<WalletScreenView {...ENTRY_PROPS} wallet={walletResult('ready')} />);
    const history = screen.getByRole('region', { name: 'Payments history stub' });
    expect(follows(screen.getByRole('region', { name: 'Balance' }), history)).toBe(true);
    expect(follows(history, screen.getByRole('button', { name: 'Send' }))).toBe(true);
    expect(follows(history, screen.getByRole('link', { name: 'Show recovery phrase' }))).toBe(true);
  });

  it('shows Send and Receive side by side above the recovery link', () => {
    setWalletAccount();
    renderWithLocale(<WalletScreenView {...ENTRY_PROPS} wallet={walletResult('ready')} />);
    const sendButton = screen.getByRole('button', { name: 'Send' });
    const receiveButton = screen.getByRole('button', { name: 'Receive' });
    expect(sendButton.parentElement).toBe(receiveButton.parentElement);
    expect(sendButton.parentElement?.className).toContain('grid-cols-2');
    expect(follows(sendButton, receiveButton)).toBe(true);
    const recovery = screen.getByRole('link', { name: 'Show recovery phrase' });
    expect(recovery.getAttribute('href')).toBe('/wallet/phrase');
    expect(follows(receiveButton, recovery)).toBe(true);
    expect(screen.queryByText('Advanced functions')).toBeNull();
  });

  it('offers Add recovery phrase with its hint below Send and Receive', () => {
    renderWithLocale(<WalletScreenView {...ENTRY_PROPS} view="activate" />);
    const add = screen.getByRole('link', { name: 'Add recovery phrase' });
    expect(add.getAttribute('href')).toBe('/wallet/phrase');
    expect(add.parentElement?.textContent).toContain(
      'This creates a recovery phrase on this device. Your existing login passkey stays.',
    );
    expect(follows(screen.getByRole('button', { name: 'Receive' }), add)).toBe(true);
    expect(screen.queryByRole('link', { name: 'Show recovery phrase' })).toBeNull();
  });

  it('enables Send only while the wallet is ready and a send flow exists; Receive always works', () => {
    setWalletAccount();
    const cases = [
      ['ready', true, true],
      ['ready', false, false],
      ['locked', true, false],
      ['connecting', true, false],
      ['error', true, false],
    ] as const;
    for (const [status, withSend, enabled] of cases) {
      const view = renderWithLocale(
        <WalletScreenView
          {...ENTRY_PROPS}
          wallet={walletResult(status)}
          {...(withSend ? { send: idleSend() } : {})}
        />,
      );
      expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
        !enabled,
      );
      expect((screen.getByRole('button', { name: 'Receive' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      view.unmount();
    }
  });

  it('ignores balance state on the phrase surface', () => {
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
        wallet={walletResult('locked')}
      />,
    );
    expect(screen.queryByRole('region', { name: 'Balance' })).toBeNull();
  });

  it('shows a timeout reason and a hint', () => {
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="activate"
        status="error"
        error="timeout"
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByText(/timed out before you finished/i)).toBeTruthy();
    expect(screen.getByText(/try another browser/i)).toBeTruthy();
  });

  it('renders twelve words on phrase view without Continue or I saved these words', () => {
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="phrase"
        status="idle"
        error={null}
        words={words}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByText('abandon')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'I saved these words' })).toBeNull();
  });

  it('hides the twelve words when Back is pressed and does not leave the page', () => {
    const hidePhrase = vi.fn();
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="phrase"
        status="idle"
        error={null}
        words={words}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={hidePhrase}
        retry={vi.fn()}
      />,
    );
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(hidePhrase).toHaveBeenCalledTimes(1);
    expect(historyBack).not.toHaveBeenCalled();
    historyBack.mockRestore();
  });

  it('opens the forum when nothing on the page is open even if history is longer', () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 2 });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderWithLocale(
      <WalletScreenView
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(assign).toHaveBeenCalledWith('/welcome');
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('opens the forum when this tab has no previous page', () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 1 });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderWithLocale(
      <WalletScreenView
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(assign).toHaveBeenCalledWith('/welcome');
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('does not show the grid when phrase view has fewer than twelve words', () => {
    renderWithLocale(
      <WalletScreenView
        view="phrase"
        status="idle"
        error={null}
        words={['abandon']}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('link', { name: 'Show recovery phrase' })).toBeTruthy();
  });

  it('starts the recovery ceremony on the phrase page', () => {
    const activate = vi.fn();
    const showPhrase = vi.fn();
    const activateView = renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="activate"
        status="idle"
        error={null}
        words={[]}
        activate={activate}
        showPhrase={showPhrase}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add recovery phrase' }));
    expect(activate).toHaveBeenCalledTimes(1);
    activateView.unmount();
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={activate}
        showPhrase={showPhrase}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show recovery phrase' }));
    expect(showPhrase).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner on the activate button while busy', () => {
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="activate"
        status="busy"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Add recovery phrase' }).querySelector('svg'),
    ).not.toBeNull();
  });

  it('shows a spinner on retry while busy', () => {
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="activate"
        status="busy"
        error="generic"
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Try again' }).querySelector('svg')).not.toBeNull();
  });

  it('shows a spinner on reveal while busy', () => {
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="reveal"
        status="busy"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Show recovery phrase' }).querySelector('svg'),
    ).not.toBeNull();
  });

  it('points at the profile when the account has no username', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: null,
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(
      <WalletScreenView
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    expect(screen.getByRole('link', { name: 'Set a username first.' }).getAttribute('href')).toBe(
      '/profile',
    );
  });

  it('shows the till address and a link to set an amount', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(
      <WalletScreenView
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.queryByText('ada@21.gifts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    const label = screen.getByText('Receive');
    const qr = screen.getByRole('img', { name: 'Open CryptoPay QR code' });
    const address = screen.getByText('ada@21.gifts');
    const copy = screen.getByRole('button', { name: 'Copy' });
    expect(follows(label, qr)).toBe(true);
    expect(follows(qr, address)).toBe(true);
    expect(follows(address, copy)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Balance' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Show recovery phrase' })).toBeNull();
    const setAmount = screen.getByRole('link', { name: 'Set an amount' });
    expect(setAmount.getAttribute('href')).toBe('/pos');
    expect(setAmount.className).not.toContain('w-full');
    expect(screen.queryByRole('heading', { name: 'Point of sale' })).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('opens the forum from the phrase page when the words are already hidden', () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 2 });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(assign).toHaveBeenCalledWith('/welcome');
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('opens the forum from the phrase page when nothing is open', () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 1 });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(assign).toHaveBeenCalledWith('/welcome');
    expect(historyBack).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
  });
});

function idleSend(extra: Partial<UseWalletSendResult> = {}): UseWalletSendResult {
  return {
    state: { step: 'input', error: null },
    busy: false,
    text: '',
    setText: vi.fn(),
    comment: '',
    setComment: vi.fn(),
    submitInput: vi.fn(),
    submitAmount: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(() => false),
    ...extra,
  };
}

const CONFIRM_STATE = {
  step: 'confirm',
  recipient: 'bob@pay.example',
  amountSats: 2_100,
  feeSats: 0,
} as const;

/**
 * Entry surface for the signed-in wallet account.
 *
 * @param status - Wallet status.
 * @param send - Send flow, or `undefined`.
 * @returns The render result.
 */
function renderEntry(
  status: UseWalletResult['status'],
  send?: UseWalletSendResult,
): ReturnType<typeof renderWithLocale> {
  setWalletAccount();
  return renderWithLocale(
    <WalletScreenView
      {...ENTRY_PROPS}
      wallet={walletResult(status)}
      {...(send === undefined ? {} : { send })}
    />,
  );
}

/**
 * Same entry surface, re-rendered with new wallet and send state.
 *
 * @param view - Earlier render.
 * @param status - Wallet status.
 * @param send - Send flow.
 */
function rerenderEntry(
  view: ReturnType<typeof renderWithLocale>,
  status: UseWalletResult['status'],
  send: UseWalletSendResult,
): void {
  view.rerender(<WalletScreenView {...ENTRY_PROPS} wallet={walletResult(status)} send={send} />);
}

describe('WalletScreenView Send', () => {
  it('opens the Send view with the camera live in place of the home view', () => {
    renderEntry('ready', idleSend());
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const region = screen.getByRole('region', { name: 'Send Bitcoin' });
    expect(region.textContent).toContain('Camera stub');
    expect(screen.getByLabelText('Payment request or address')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Wallet' }).className).toContain('sr-only');
    expect(screen.queryByRole('region', { name: 'Balance' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Receive' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Payments history stub' })).toBeNull();
  });

  it('Back from the idle input step clears the field and returns home', () => {
    const send = idleSend({ text: 'lnbc1' });
    renderEntry('ready', send);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    pressBack();
    expect(send.cancel).toHaveBeenCalledTimes(1);
    expect(send.setText).toHaveBeenCalledWith('');
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Balance' })).toBeTruthy();
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('Back first closes an open send step and stays on Send', () => {
    const send = idleSend({ state: CONFIRM_STATE, cancel: vi.fn(() => true) });
    renderEntry('ready', send);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    pressBack();
    expect(send.cancel).toHaveBeenCalledTimes(1);
    expect(send.setText).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Send Bitcoin' })).toBeTruthy();
  });

  it('holds Back while the input is read', () => {
    const send = idleSend({ busy: true, text: 'lnbc1' });
    renderEntry('ready', send);
    pressBack();
    expect(send.cancel).toHaveBeenCalledTimes(1);
    expect(send.setText).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Send Bitcoin' })).toBeTruthy();
  });

  it('pins the Send view while a send runs, Sent shows, or an alert is up, even when not ready', () => {
    const busy = idleSend({ state: CONFIRM_STATE, busy: true, cancel: vi.fn(() => true) });
    renderEntry('locked', busy);
    expect(screen.getByRole('region', { name: 'Send Bitcoin' })).toBeTruthy();
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    pressBack();
    expect(busy.cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Send Bitcoin' })).toBeTruthy();
    cleanup();
    renderEntry('error', idleSend({ state: { step: 'sent', amountSats: 2_100 } }));
    expect(screen.getByRole('status').textContent).toContain("Sent ₿2'100");
    cleanup();
    renderEntry('locked', idleSend({ state: { step: 'input', error: 'failed' } }));
    expect(screen.getByRole('alert').textContent).toBe(
      'The payment could not be sent. Check your balance before you try again.',
    );
    expect(screen.queryByLabelText('Payment request or address')).toBeNull();
    cleanup();
    renderEntry('ready', idleSend({ state: { step: 'input', error: 'failed' } }));
    expect(screen.getByLabelText('Payment request or address')).toBeTruthy();
    expect(screen.queryByText('Camera stub')).toBeNull();
    cleanup();
    renderEntry('locked', idleSend());
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('Back on an input alert clears it and returns home', () => {
    const failed = idleSend({ state: { step: 'input', error: 'failed' } });
    const view = renderEntry('ready', failed);
    pressBack();
    expect(failed.setText).toHaveBeenCalledWith('');
    rerenderEntry(view, 'ready', idleSend());
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Balance' })).toBeTruthy();
  });

  it('returns home after Done on the Sent line', () => {
    const view = renderEntry('ready', idleSend());
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    rerenderEntry(view, 'ready', idleSend({ state: CONFIRM_STATE }));
    rerenderEntry(view, 'ready', idleSend({ state: { step: 'sent', amountSats: 2_100 } }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    rerenderEntry(view, 'ready', idleSend());
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });

  it('returns home when the wallet stops being ready and stays there when it is ready again', () => {
    const view = renderEntry('ready', idleSend());
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('region', { name: 'Send Bitcoin' })).toBeTruthy();
    rerenderEntry(view, 'locked', idleSend());
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Unlock wallet' })).toBeTruthy();
    rerenderEntry(view, 'ready', idleSend());
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
  });

  it('leaves the page with Back from home without asking the send flow', () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 1 });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign, hostname: '21.gifts' });
    const send = idleSend();
    renderEntry('ready', send);
    pressBack();
    expect(send.cancel).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/welcome');
  });
});

describe('WalletScreenView Receive', () => {
  it('opens Receive from home even while the wallet is locked, and Back returns home', () => {
    renderEntry('locked', idleSend());
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    expect(screen.getByText('ada@21.gifts')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Balance' })).toBeNull();
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    pressBack();
    expect(historyBack).not.toHaveBeenCalled();
    expect(screen.queryByText('ada@21.gifts')).toBeNull();
    expect(screen.getByRole('button', { name: 'Unlock wallet' })).toBeTruthy();
  });

  it('copies the address and says Copied for two seconds', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      renderEntry('ready');
      fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_999);
      });
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('keeps Copy when the clipboard refuses the write or is missing', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      renderEntry('ready');
      fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
      Reflect.deleteProperty(navigator, 'clipboard');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('shows only Set an amount when signed out', () => {
    renderWithLocale(<WalletScreenView {...ENTRY_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Set a username first.' })).toBeNull();
  });
});
