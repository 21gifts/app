import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FundingApplyPage from '@/app/profile/apply/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/FundingApplyScreen', () => ({
  FundingApplyScreen: () => <div data-testid="funding-apply-screen" />,
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: () => <div data-testid="profile-chrome-left" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('FundingApplyPage', () => {
  it('renders the apply walk behind signed-in chrome', () => {
    const { container } = renderWithLocale(<FundingApplyPage />);
    expect(screen.getByTestId('funding-apply-screen')).toBeTruthy();
    expect(screen.getByTestId('profile-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
