import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MemberVerifyPage from '@/app/members/[accountId]/verify/page';
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

vi.mock('@/components/MemberVerifyScreen', () => ({
  MemberVerifyScreen: () => <div data-testid="member-verify-screen" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('MemberVerifyPage', () => {
  it('renders the verify screen inside signed-in chrome', async () => {
    const page = await MemberVerifyPage({
      params: Promise.resolve({ accountId: '22222222-2222-4222-8222-222222222222' }),
    });
    renderWithLocale(page);
    expect(screen.getByTestId('member-verify-screen')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });
});
