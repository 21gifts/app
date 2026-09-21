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
});
