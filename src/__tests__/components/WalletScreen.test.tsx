import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletScreen, WalletScreenView } from '@/components/WalletScreen';
import {
  WALLET_VISUAL_FIXTURE_MNEMONIC,
  type UseWalletPhraseResult,
} from '@/hooks/useWalletPhrase';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const showPhrase = vi.fn();
vi.mock('@/hooks/useWalletPhrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useWalletPhrase')>();
  return {
    ...actual,
    useWalletPhrase: (): UseWalletPhraseResult => ({
      view: 'confirm',
      status: 'idle',
      error: null,
      words: [],
      activate: vi.fn(),
      confirmSaved: vi.fn(),
      showPhrase,
      hidePhrase: vi.fn(),
      retry: vi.fn(),
    }),
  };
});

afterEach(cleanup);

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
    renderWithLocale(<WalletScreen />);
    expect(showPhrase).toHaveBeenCalled();
  });
});
