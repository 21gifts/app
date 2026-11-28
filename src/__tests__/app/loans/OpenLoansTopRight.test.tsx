import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenLoansTopRight } from '@/app/loans/OpenLoansTopRight';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <button type="button">Menu</button>,
}));

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null, lockedSession: null });
});

describe('OpenLoansTopRight', () => {
  it('links to login when nobody is signed in', () => {
    useAuthStore.setState({ session: null, account: null, lockedSession: null });
    renderWithLocale(<OpenLoansTopRight />);
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(
      '/login?next=%2Floans',
    );
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('shows the signed-in menu when a session exists', () => {
    useAuthStore.setState({ session: 'token', account: null, lockedSession: null });
    renderWithLocale(<OpenLoansTopRight />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('shows no Log in link for a held-back session (the login card is in the page)', () => {
    useAuthStore.setState({ session: null, account: null, lockedSession: 'held' });
    renderWithLocale(<OpenLoansTopRight />);
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
  });
});
