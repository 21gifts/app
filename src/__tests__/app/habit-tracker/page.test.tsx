import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import HabitTrackerPage from '@/app/habit-tracker/page';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/MemberHabits', () => ({
  MemberHabits: () => <div data-testid="member-habits" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('HabitTrackerPage', () => {
  it('shows a log in link when signed out', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<HabitTrackerPage />);
    expect(screen.getByTestId('member-habits')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByTestId('signed-in-chrome')).toBeNull();
  });

  it('shows the signed-in menu when a session exists', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<HabitTrackerPage />);
    expect(screen.getByTestId('member-habits')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });
});
