import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import WelcomePage from '@/app/welcome/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/components/WelcomeScreen', () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('WelcomePage', () => {
  it('renders the welcome card and a log in link when signed out', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<WelcomePage />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByTestId('signed-in-chrome')).toBeNull();
  });

  it('renders the signed-in chrome when a session exists', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<WelcomePage />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });
});
