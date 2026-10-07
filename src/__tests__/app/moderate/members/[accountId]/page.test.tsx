import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TeamMemberDataPage from '@/app/moderate/members/[accountId]/page';
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

vi.mock('@/components/TeamMemberDataScreen', () => ({
  TeamMemberDataScreen: ({ accountId }: { accountId: string }) => (
    <div data-testid="member-data">{accountId}</div>
  ),
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('TeamMemberDataPage', () => {
  it('passes the route account id to the screen inside signed-in chrome', async () => {
    renderWithLocale(
      await TeamMemberDataPage({ params: Promise.resolve({ accountId: 'acc_ada' }) }),
    );
    expect(screen.getByTestId('member-data').textContent).toBe('acc_ada');
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
  });
});
