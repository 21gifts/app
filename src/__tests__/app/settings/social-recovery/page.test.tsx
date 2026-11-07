import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SocialRecoveryPage from '@/app/settings/social-recovery/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/SocialRecoveryScreen', () => ({
  SocialRecoveryScreen: () => <div data-testid="social-recovery-screen" />,
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

describe('SocialRecoveryPage', () => {
  it('renders the setup screen behind the profile gate and signed-in chrome', () => {
    const { container } = renderWithLocale(<SocialRecoveryPage />);
    expect(
      screen.getByTestId('gate-profile').contains(screen.getByTestId('social-recovery-screen')),
    ).toBe(true);
    expect(screen.getByTestId('profile-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
