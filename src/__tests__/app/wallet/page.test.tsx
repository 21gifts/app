import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WalletPage from '@/app/wallet/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/WalletScreen', () => ({
  WalletScreen: () => <div data-testid="wallet-screen" />,
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

describe('WalletPage', () => {
  it('renders the wallet card behind signed-in chrome', () => {
    const { container } = renderWithLocale(<WalletPage />);
    expect(screen.getByTestId('wallet-screen')).toBeTruthy();
    expect(screen.getByTestId('wallet-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
