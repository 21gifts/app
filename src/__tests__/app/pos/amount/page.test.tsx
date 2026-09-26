import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PosAmountPage from '@/app/pos/amount/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/PosScreen', () => ({
  PosAmount: () => <div data-testid="pos-amount" />,
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: ({ backHref }: { backHref?: string }) => (
    <div data-testid="profile-chrome-left">{backHref}</div>
  ),
}));
vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('PosAmountPage', () => {
  it('renders the amount form and returns to the till', () => {
    const { container } = renderWithLocale(<PosAmountPage />);
    expect(screen.getByTestId('pos-amount')).toBeTruthy();
    expect(screen.getByTestId('profile-chrome-left').textContent).toBe('/pos');
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
    expect(main?.className).not.toContain('overflow-hidden');
  });
});
