import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WalletPhrasePage from '@/app/wallet/phrase/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/WalletScreen', () => ({
  WalletPhraseScreen: () => <div data-testid="wallet-phrase-screen" />,
}));
vi.mock('@/components/WalletChromeLeft', () => ({
  WalletChromeLeft: () => <div data-testid="wallet-chrome-left" />,
}));
vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('WalletPhrasePage', () => {
  it('renders the recovery phrase behind signed-in chrome', () => {
    const { container } = renderWithLocale(<WalletPhrasePage />);
    expect(screen.getByTestId('wallet-phrase-screen')).toBeTruthy();
    expect(screen.getByTestId('wallet-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
