import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import NameSetupPage from '@/app/setup/name/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/NameSetup', () => ({
  NameSetup: () => <div data-testid="name-setup" />,
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

describe('NameSetupPage', () => {
  it('renders the name setup card', () => {
    renderWithLocale(<NameSetupPage />);
    expect(screen.getByTestId('name-setup')).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });
});
