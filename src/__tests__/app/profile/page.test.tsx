import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/app/profile/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/ProfileScreen', () => ({
  ProfileScreen: () => <div data-testid="profile-screen" />,
  ProfileChromeLeft: () => <div data-testid="profile-chrome-left" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('ProfilePage', () => {
  it('renders the profile card behind signed-in chrome', () => {
    renderWithLocale(<ProfilePage />);
    expect(screen.getByTestId('profile-screen')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
