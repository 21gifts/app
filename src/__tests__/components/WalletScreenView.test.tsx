import { cleanup, fireEvent, screen } from '@testing-library/react';
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
    ['ready', "₿21'000 · $21.00"],
    ['error', 'Your wallet could not be opened. Please try again.'],
  ] as const)('renders the %s balance under the heading and above the address', (status, text) => {
    setWalletAccount();
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
        wallet={walletResult(status)}
      />,
    );
    const heading = screen.getByRole('heading', { name: 'Wallet' });
    const balance = screen.getByRole('region', { name: 'Balance' });
    const address = screen.getByText('ada@21.gifts');
    expect(balance.textContent).toContain(text);
    expect(heading.compareDocumentPosition(balance) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(balance.compareDocumentPosition(address) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

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

  it('shows the payment list only while the wallet is ready, between address and recovery', () => {
    const props = {
      view: 'reveal' as const,
      status: 'idle' as const,
      error: null,
      words: [],
      activate: vi.fn(),
      showPhrase: vi.fn(),
      hidePhrase: vi.fn(),
      retry: vi.fn(),
    };
    setWalletAccount();
    for (const status of ['disabled', 'locked', 'connecting', 'error'] as const) {
      const view = renderWithLocale(<WalletScreenView {...props} wallet={walletResult(status)} />);
      expect(screen.queryByRole('region', { name: 'Payments history stub' })).toBeNull();
      view.unmount();
    }
    const ready = renderWithLocale(<WalletScreenView {...props} wallet={walletResult('ready')} />);
    const history = screen.getByRole('region', { name: 'Payments history stub' });
    const html = ready.container.innerHTML;
    expect(html.indexOf('Payments history stub')).toBeGreaterThan(html.indexOf('ada@'));
    expect(html.indexOf('Payments history stub')).toBeLessThan(html.indexOf('Advanced functions'));
    expect(history).toBeTruthy();
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

  it('closes Advanced functions before leaving the page', () => {
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
    const details = screen.getByText('Advanced functions').closest('details');
    if (details === null) {
      throw new Error('missing details');
    }
    details.open = true;
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(details.open).toBe(false);
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
    expect(screen.getByText('Advanced functions')).toBeTruthy();
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

  it('opens Advanced functions to Show recovery phrase', () => {
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
    fireEvent.click(screen.getByText('Advanced functions'));
    expect(screen.getByRole('link', { name: 'Show recovery phrase' }).getAttribute('href')).toBe(
      '/wallet/phrase',
    );
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
        lightningAddress: 'ada@walletofsatoshi.com',
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
    expect(screen.getByText('ada@21.gifts')).toBeTruthy();
    const heading = screen.getByRole('heading', { name: 'Wallet' });
    const address = screen.getByText('ada@21.gifts');
    expect(heading.compareDocumentPosition(address) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const recovery = screen.getByText('Advanced functions');
    expect(address.compareDocumentPosition(recovery) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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

describe('WalletScreenView send block', () => {
  function sendResult(cancel: () => boolean): UseWalletSendResult {
    return {
      state: { step: 'confirm', recipient: 'bob@pay.example', amountSats: 2_100, feeSats: 0 },
      busy: false,
      text: '',
      setText: vi.fn(),
      comment: '',
      setComment: vi.fn(),
      submitInput: vi.fn(),
      submitAmount: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(cancel),
    };
  }

  function renderEntry(status: UseWalletResult['status'], send?: UseWalletSendResult): void {
    setWalletAccount();
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
        wallet={walletResult(status)}
        {...(send === undefined ? {} : { send })}
      />,
    );
  }

  it('shows the send block under the balance only while the wallet is ready', () => {
    renderEntry(
      'ready',
      sendResult(() => true),
    );
    const balance = screen.getByRole('region', { name: 'Balance' });
    const send = screen.getByRole('region', { name: 'Send Bitcoin' });
    expect(balance.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();
    renderEntry(
      'locked',
      sendResult(() => true),
    );
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    cleanup();
    renderEntry('ready');
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
  });

  it('Back closes an open send step before anything else', () => {
    const send = sendResult(() => true);
    renderEntry('ready', send);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('Back continues to Advanced functions when no send step is open', () => {
    const send = sendResult(() => false);
    renderEntry('ready', send);
    const details = screen.getByText('Advanced functions').closest('details');
    if (details === null) {
      throw new Error('missing details');
    }
    details.open = true;
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
    expect(details.open).toBe(false);
  });
});
