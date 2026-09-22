import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletScreenView } from '@/components/WalletScreenView';
import { WALLET_VISUAL_FIXTURE_MNEMONIC } from '@/hooks/useWalletPhrase';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const words = WALLET_VISUAL_FIXTURE_MNEMONIC.split(' ');

describe('WalletScreenView', () => {
  it('renders the wallet heading', () => {
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
  });

  it('shows Continue during setup instead of I saved these words', () => {
    renderWithLocale(
      <WalletScreenView
        view="phrase"
        status="idle"
        error={null}
        words={words}
        setupWallet
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'I saved these words' })).toBeNull();
  });

  it('shows a timeout reason and a hint', () => {
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
    expect(screen.getByText(/timed out before you finished/i)).toBeTruthy();
    expect(screen.getByText(/try another browser/i)).toBeTruthy();
  });

  it('renders twelve words on phrase view', () => {
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
  });

  it('shows a spinner on the activate button while busy', () => {
    renderWithLocale(
      <WalletScreenView
        view="activate"
        status="busy"
        error={null}
        words={[]}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Activate recovery phrase' }).querySelector('svg'),
    ).not.toBeNull();
  });

  it('shows a spinner on retry while busy', () => {
    renderWithLocale(
      <WalletScreenView
        view="activate"
        status="busy"
        error="generic"
        words={[]}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Try again' }).querySelector('svg')).not.toBeNull();
  });

  it('shows a spinner on confirm while busy', () => {
    renderWithLocale(
      <WalletScreenView
        view="confirm"
        status="busy"
        error={null}
        words={words}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'I saved these words' }).querySelector('svg'),
    ).not.toBeNull();
  });

  it('shows a spinner on reveal while busy', () => {
    renderWithLocale(
      <WalletScreenView
        view="reveal"
        status="busy"
        error={null}
        words={[]}
        activate={vi.fn()}
        confirmSaved={vi.fn()}
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByText('Advanced functions')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Show recovery phrase' }).querySelector('svg'),
    ).not.toBeNull();
  });
});
