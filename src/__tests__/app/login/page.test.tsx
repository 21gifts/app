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

vi.mock('@/components/ThemeSwitcher', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

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

  it('renders the theme switcher', () => {
    renderWithLocale(<LoginPage />);
    expect(screen.getByTestId('theme-switcher')).toBeTruthy();
  });
});
