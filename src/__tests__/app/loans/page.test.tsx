import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import OpenLoansPage from '@/app/loans/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/app/loans/OpenLoansScreen', () => ({
  OpenLoansScreen: () => <div data-testid="open-loans-screen" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null, lockedSession: null });
});

describe('OpenLoansPage', () => {
  it('renders the open-loans screen and a Log in link when signed out', () => {
    useAuthStore.setState({ session: null, account: null, lockedSession: null });
    renderWithLocale(<OpenLoansPage />);
    expect(screen.getByTestId('open-loans-screen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(
      '/login?next=%2Floans',
    );
    expect(screen.queryByTestId('signed-in-chrome')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('renders signed-in chrome when a session exists', () => {
    useAuthStore.setState({ session: 'sess', account: null, lockedSession: null });
    renderWithLocale(<OpenLoansPage />);
    expect(screen.getByTestId('open-loans-screen')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('shows no Log in link for a held-back session (the login card is in the page)', () => {
    useAuthStore.setState({ session: null, account: null, lockedSession: 'held' });
    renderWithLocale(<OpenLoansPage />);
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
