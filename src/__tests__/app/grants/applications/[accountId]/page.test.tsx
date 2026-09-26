import { cleanup, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FundingApplicationDetailPage from '@/app/grants/applications/[accountId]/page';
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

vi.mock('@/components/FundingApplicationDetailScreen', () => ({
  FundingApplicationDetailScreen: ({ accountId }: { accountId: string }): ReactElement => (
    <div data-testid={`funding-detail-${accountId}`} />
  ),
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('FundingApplicationDetailPage', () => {
  it('renders the detail screen inside signed-in chrome', async () => {
    const page = await FundingApplicationDetailPage({
      params: Promise.resolve({ accountId: 'acc_rose' }),
    });
    renderWithLocale(page);
    expect(screen.getByTestId('funding-detail-acc_rose')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
  });
});
