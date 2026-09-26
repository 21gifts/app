import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletPhraseScreen, WalletScreen } from '@/components/WalletScreen';
import { WalletScreenView } from '@/components/WalletScreenView';
import {
  WALLET_VISUAL_FIXTURE_MNEMONIC,
  type UseWalletPhraseResult,
} from '@/hooks/useWalletPhrase';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const showPhrase = vi.fn();
const retry = vi.fn();
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

afterEach(() => {
  cleanup();
  phraseState.error = null;
  phraseState.view = 'activate';
  phraseState.words = [];
  phraseState.status = 'idle';
});

const words = WALLET_VISUAL_FIXTURE_MNEMONIC.split(' ');

describe('WalletScreenView', () => {
  it('renders Add recovery phrase', () => {
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
    expect(screen.getByRole('link', { name: 'Add recovery phrase' }).getAttribute('href')).toBe(
      '/wallet/phrase',
    );
  });

  it('renders Show recovery phrase', () => {
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
    expect(screen.getByText('Advanced functions')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Show recovery phrase' }).getAttribute('href')).toBe(
      '/wallet/phrase',
    );
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
    expect(screen.getByText(/cannot create a recovery phrase/i)).toBeTruthy();
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
    expect(screen.getByRole('link', { name: 'Add recovery phrase' })).toBeTruthy();
  });

  it('calls retry from Try again on the phrase page', () => {
    retry.mockClear();
    phraseState.error = 'timeout';
    renderWithLocale(<WalletPhraseScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
  });

  it('does not show the recovery words on the receive page', () => {
    phraseState.view = 'phrase';
    phraseState.words = words;
    renderWithLocale(<WalletScreen />);
    expect(screen.queryByText('abandon')).toBeNull();
    expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
  });
});
