import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PayoutsPage from '@/app/moderate/payouts/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/FundingPayoutsScreen', () => ({
  FundingPayoutsScreen: () => <div data-testid="payouts-screen" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('PayoutsPage', () => {
  it('renders the payouts screen inside signed-in chrome', () => {
    renderWithLocale(<PayoutsPage />);
    expect(screen.getByTestId('payouts-screen')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });
});
