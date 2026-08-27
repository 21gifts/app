import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import LoginPage from '@/app/login/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/LoginCard', () => ({
  LoginCard: () => <div data-testid="login-card" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('LoginPage', () => {
  it('renders the page heading', async () => {
    renderWithLocale(await LoginPage());
    expect(screen.getByRole('heading', { name: 'Log in to 21.gifts' })).toBeTruthy();
  });

  it('renders the login card', async () => {
    renderWithLocale(await LoginPage());
    expect(screen.getByTestId('login-card')).toBeTruthy();
  });

  it('renders the language switcher', async () => {
    renderWithLocale(await LoginPage());
    expect(screen.getByTestId('language-switcher')).toBeTruthy();
  });
});
