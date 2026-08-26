import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import WelcomePage from '@/app/welcome/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/WelcomeScreen', () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/components/LogoutButton', () => ({
  LogoutButton: () => (
    <button type="button" data-testid="logout-button">
      Log out
    </button>
  ),
}));

afterEach(cleanup);

describe('WelcomePage', () => {
  it('renders the welcome card', () => {
    renderWithLocale(<WelcomePage />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });
});
