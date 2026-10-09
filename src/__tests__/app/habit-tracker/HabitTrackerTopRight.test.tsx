import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HabitTrackerTopRight } from '@/app/habit-tracker/HabitTrackerTopRight';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <button type="button">Menu</button>,
}));

const account: Account = {
  id: 'acc-owner',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
});

describe('HabitTrackerTopRight', () => {
  it('links to login when nobody is signed in', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<HabitTrackerTopRight />);
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('shows the signed-in menu when a session exists', () => {
    useAuthStore.setState({ session: 'token', account });
    renderWithLocale(<HabitTrackerTopRight />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('shows no Log in link for a held-back session (the login card is in the page)', () => {
    useAuthStore.setState({ session: null, account: null, lockedSession: 'held' });
    renderWithLocale(<HabitTrackerTopRight />);
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
  });
});
