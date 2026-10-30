import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PreviousWalletPage from '@/app/settings/previous-wallets/[sparkPubkey]/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/RemainingBalanceScreen', () => ({
  RemainingBalanceScreen: ({ sparkPubkey }: { sparkPubkey: string }) => (
    <div data-testid={`remaining-${sparkPubkey}`} />
  ),
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

describe('PreviousWalletPage', () => {
  it('renders the previous wallet behind the profile gate and signed-in chrome', async () => {
    const key = `02${'c'.repeat(64)}`;
    const page = await PreviousWalletPage({ params: Promise.resolve({ sparkPubkey: key }) });
    const { container } = renderWithLocale(page);
    expect(
      screen.getByTestId('gate-profile').contains(screen.getByTestId(`remaining-${key}`)),
    ).toBe(true);
    expect(screen.getByTestId('profile-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
