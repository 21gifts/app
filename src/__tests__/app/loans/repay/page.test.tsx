import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoanRepayPage from '@/app/loans/repay/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/LoanRepayScreen', () => ({
  LoanRepayScreen: () => <div data-testid="loan-repay" />,
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

describe('LoanRepayPage', () => {
  it('renders the repayment screen behind the wallet chrome', () => {
    renderWithLocale(<LoanRepayPage />);
    expect(screen.getByTestId('loan-repay')).toBeTruthy();
    expect(screen.getByTestId('wallet-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
