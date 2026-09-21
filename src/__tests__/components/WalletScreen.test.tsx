import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletScreen, WalletScreenView } from '@/components/WalletScreen';
import {
  WALLET_VISUAL_FIXTURE_MNEMONIC,
  type UseWalletPhraseResult,
} from '@/hooks/useWalletPhrase';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const showPhrase = vi.fn();
const retry = vi.fn();
const phraseState: UseWalletPhraseResult = {
  view: 'confirm',
  status: 'idle',
  error: null,
  words: [],
  activate: vi.fn(),
  confirmSaved: vi.fn(),
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
  phraseState.view = 'confirm';
  phraseState.words = [];
});

const words = WALLET_VISUAL_FIXTURE_MNEMONIC.split(' ');

describe('WalletScreenView', () => {
  it('renders Activate recovery phrase', () => {
    renderWithLocale(
      <WalletScreenView
        view="activate"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Wallet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activate recovery phrase' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Activate recovery phrase' }));
  });

  it('renders Show recovery phrase', () => {
    renderWithLocale(
      <WalletScreenView
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Show recovery phrase' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show recovery phrase' }));
  });

  it('renders Try again on timeout', () => {
    renderWithLocale(
      <WalletScreenView
        view="activate"
        status="error"
        error="timeout"
        words={[]}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate recovery phrase' })).toBeNull();
  });

  it('renders PRF unsupported copy', () => {
    renderWithLocale(
      <WalletScreenView
        view="activate"
        status="error"
        error="prfUnsupported"
        words={[]}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByText(/cannot create a recovery phrase/i)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders twelve words without confirm on phrase view', () => {
    renderWithLocale(
      <WalletScreenView
        view="phrase"
        status="idle"
        error={null}
        words={words}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByText('abandon')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'I saved these words' })).toBeNull();
  });

  it('renders the confirm button with twelve words', () => {
    renderWithLocale(
      <WalletScreenView
        view="confirm"
        status="idle"
        error={null}
        words={words}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'I saved these words' })).toBeTruthy();
    expect(screen.getByText('abandon')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I saved these words' }));
  });
});

describe('WalletScreen', () => {
  it('asks to show the phrase when confirm has no words yet', () => {
    showPhrase.mockClear();
    phraseState.error = null;
    const view = renderWithLocale(<WalletScreen />);
    expect(showPhrase).toHaveBeenCalledTimes(1);
    view.rerender(<WalletScreen />);
    expect(showPhrase).toHaveBeenCalledTimes(1);
  });

  it('retries auto-reveal after Try again', () => {
    showPhrase.mockClear();
    retry.mockClear();
    phraseState.error = 'timeout';
    renderWithLocale(<WalletScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });
});
