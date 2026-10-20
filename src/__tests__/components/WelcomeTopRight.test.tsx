import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeTopRight } from '@/components/WelcomeTopRight';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <button type="button">Menu</button>,
}));

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
});

afterEach(() => {
  useAuthStore.setState({ session: null, account: null });
  cleanup();
});

describe('WelcomeTopRight', () => {
  it('links to login when there is no session', () => {
    renderWithLocale(<WelcomeTopRight />);
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('renders signed-in chrome instead of the login link when a session exists', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(<WelcomeTopRight />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });
});
