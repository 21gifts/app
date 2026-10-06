import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/settings/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/SettingsScreen', () => ({
  SettingsScreen: () => <div data-testid="settings-screen" />,
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: () => <div data-testid="profile-chrome-left" />,
}));
vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children, screen }: { children: ReactNode; screen: string }) => (
    <div data-testid={`gate-${screen}`}>{children}</div>
  ),
}));
vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('SettingsPage', () => {
  it('renders the settings screen behind the profile gate and signed-in chrome', () => {
    const { container } = renderWithLocale(<SettingsPage />);
    expect(screen.getByTestId('gate-profile').contains(screen.getByTestId('settings-screen'))).toBe(
      true,
    );
    expect(screen.getByTestId('profile-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
