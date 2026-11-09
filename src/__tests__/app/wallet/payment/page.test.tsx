import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WalletPaymentPage from '@/app/wallet/payment/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/WalletPaymentDetails', () => ({
  WalletPaymentDetails: () => <div data-testid="wallet-payment" />,
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

describe('WalletPaymentPage', () => {
  it('renders the payment screen behind the wallet chrome', () => {
    renderWithLocale(<WalletPaymentPage />);
    expect(screen.getByTestId('wallet-payment')).toBeTruthy();
    expect(screen.getByTestId('wallet-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
