import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeldSharesPage from '@/app/settings/held-shares/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/HeldSharesScreen', () => ({
  HeldSharesScreen: () => <div data-testid="held-shares-screen" />,
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

describe('HeldSharesPage', () => {
  it('renders the kept-shares screen behind the profile gate and signed-in chrome', () => {
    const { container } = renderWithLocale(<HeldSharesPage />);
    expect(
      screen.getByTestId('gate-profile').contains(screen.getByTestId('held-shares-screen')),
    ).toBe(true);
    expect(screen.getByTestId('profile-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
