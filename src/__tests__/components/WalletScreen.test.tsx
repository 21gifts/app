import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletPhraseScreen, WalletScreen } from '@/components/WalletScreen';
import { WalletScreenView } from '@/components/WalletScreenView';
import type { UseWalletResult } from '@/hooks/useWallet';
import {
  WALLET_VISUAL_FIXTURE_MNEMONIC,
  type UseWalletPhraseResult,
} from '@/hooks/useWalletPhrase';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const showPhrase = vi.fn();
const retry = vi.fn();
const { walletState, useWalletMock } = vi.hoisted(() => {
  const state: UseWalletResult = {
    status: 'connecting',
    balanceSats: null,
    retry: vi.fn(),
    setupFailed: false,
    canReceive: true,
  };
  return { walletState: state, useWalletMock: vi.fn((): UseWalletResult => state) };
});
const phraseState: UseWalletPhraseResult = {
  view: 'activate',
  status: 'idle',
  error: null,
  words: [],
  activate: vi.fn(),
  showPhrase,
  hidePhrase: vi.fn(),
  retry,
};
vi.mock('@/hooks/useWalletPhrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useWalletPhrase')>();
  return {
    ...actual,
    useWalletPhrase: (): UseWalletPhraseResult => phraseState,
  };
});
vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

afterEach(() => {
  cleanup();
  phraseState.error = null;
  phraseState.view = 'activate';
  phraseState.words = [];
  phraseState.status = 'idle';
  walletState.status = 'connecting';
  walletState.balanceSats = null;
  walletState.setupFailed = false;
  walletState.canReceive = true;
  useWalletMock.mockClear();
});

const words = WALLET_VISUAL_FIXTURE_MNEMONIC.split(' ');

describe('WalletScreenView', () => {
  it('renders the home without a recovery link when the account has no phrase', () => {
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
    expect(screen.queryByRole('link', { name: 'Add recovery phrase' })).toBeNull();
  });

  it('renders the home without a recovery link when the account has a phrase', () => {
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
    expect(screen.queryByText('Advanced functions')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Show recovery phrase' })).toBeNull();
  });

  it('renders Try again on timeout', () => {
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
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add recovery phrase' })).toBeNull();
  });

  it('renders PRF unsupported copy', () => {
    renderWithLocale(
      <WalletScreenView
        surface="phrase"
        view="activate"
        status="error"
        error="prfUnsupported"
        words={[]}
        activate={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByText(/cannot hold a 21\.gifts wallet/i)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders twelve words without Continue or I saved these words', () => {
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
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'I saved these words' })).toBeNull();
  });
});

describe('WalletScreen', () => {
  it('renders the hook view', () => {
    phraseState.view = 'activate';
    phraseState.words = [];
    phraseState.error = null;
    renderWithLocale(<WalletScreen />);
    expect(screen.getByRole('button', { name: 'Receive' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Balance' })).toBeTruthy();
    expect(useWalletMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
  });

  it('opens the send flow from Send while the wallet is ready', () => {
    walletState.status = 'ready';
    walletState.balanceSats = 21_000;
    renderWithLocale(<WalletScreen />);
    expect(screen.queryByRole('region', { name: 'Send Bitcoin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('region', { name: 'Send Bitcoin' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enter manually' }));
    expect(screen.getByLabelText('Payment request or address')).toBeTruthy();
  });

  it('calls retry from Try again on the phrase page', () => {
    retry.mockClear();
    phraseState.error = 'timeout';
    renderWithLocale(<WalletPhraseScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
    expect(useWalletMock).not.toHaveBeenCalled();
  });

  it('does not show the recovery words on the wallet page or in Receive', () => {
    phraseState.view = 'phrase';
    phraseState.words = words;
    renderWithLocale(<WalletScreen />);
    expect(screen.queryByText('abandon')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    expect(screen.queryByText('abandon')).toBeNull();
    expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
  });
});
