import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import LoginPage from '@/app/login/page';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/LoginCard', () => ({
  LoginCard: () => <div data-testid="login-card" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

beforeEach(() => {
  hydrateReady = true;
  useAuthStore.setState({ session: null, account: null });
});

afterEach(cleanup);

describe('LoginPage', () => {
  it('renders the login card', () => {
    renderWithLocale(<LoginPage />);
    expect(screen.getByTestId('login-card')).toBeTruthy();
  });

  it('renders the language switcher', () => {
    renderWithLocale(<LoginPage />);
    expect(screen.getByTestId('language-switcher')).toBeTruthy();
  });

  it('links the unsigned wordmark home', () => {
    renderWithLocale(<LoginPage />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
  });
});
