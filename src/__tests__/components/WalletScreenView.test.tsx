import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletScreenView } from '@/components/WalletScreenView';
import { WALLET_VISUAL_FIXTURE_MNEMONIC } from '@/hooks/useWalletPhrase';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const back = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { back: typeof back; push: typeof push } => ({ back, push }),
}));

afterEach(() => {
  cleanup();
  back.mockClear();
  push.mockClear();
});

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
        showPhrase={vi.fn()}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Wallet' })).toBeTruthy();
  });

  it('shows a timeout reason and a hint', () => {
    renderWithLocale(
      <WalletScreenView
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

  it('hides the twelve words when Back is pressed and does not leave the page', () => {
    const hidePhrase = vi.fn();
    renderWithLocale(
      <WalletScreenView
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
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(hidePhrase).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(details.open).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });

  it('goes back one history step when nothing on the page is open', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.history, 'length');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 2 });
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
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    if (descriptor) {
      Object.defineProperty(window.history, 'length', descriptor);
    }
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

  it('shows a spinner on the activate button while busy', () => {
    renderWithLocale(
      <WalletScreenView
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
    const showPhrase = vi.fn();
    renderWithLocale(
      <WalletScreenView
        view="reveal"
        status="idle"
        error={null}
        words={[]}
        activate={vi.fn()}
        showPhrase={showPhrase}
        hidePhrase={vi.fn()}
        retry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Advanced functions'));
    fireEvent.click(screen.getByRole('button', { name: 'Show recovery phrase' }));
    expect(showPhrase).toHaveBeenCalled();
  });

  it('shows a spinner on reveal while busy', () => {
    renderWithLocale(
      <WalletScreenView
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
    expect(screen.getByText('Advanced functions')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Show recovery phrase' }).querySelector('svg'),
    ).not.toBeNull();
  });
});
