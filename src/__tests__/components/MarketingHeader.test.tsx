import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingHeader } from '@/components/MarketingHeader';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
  }: {
    href: string;
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

beforeEach(() => {
  hydrateReady = true;
  useAuthStore.setState({ session: null, account: null });
});

afterEach(cleanup);

describe('MarketingHeader', () => {
  it('links the wordmark home and Log in to /login', () => {
    renderWithLocale(<MarketingHeader />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Stats', hidden: true }).getAttribute('href')).toBe(
      '/stats',
    );
    expect(screen.getByRole('link', { name: 'About', hidden: true }).getAttribute('href')).toBe(
      '/about',
    );
    expect(screen.queryByRole('link', { name: 'Trust Chain', hidden: true })).toBeNull();
    expect(screen.getByRole('link', { name: 'Handbook', hidden: true }).getAttribute('href')).toBe(
      '/handbook',
    );
    expect(screen.getByRole('link', { name: 'Log in', hidden: true }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('links the wordmark to /welcome when a session is hydrated', () => {
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
        setup: null,
        missing: [],
        aboutMe: null,
      },
    });
    renderWithLocale(<MarketingHeader />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
    expect(screen.getByRole('link', { name: 'Log in', hidden: true }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('always shows the language switcher and does not show Number format', () => {
    renderWithLocale(<MarketingHeader />);
    expect(screen.getByLabelText('Language')).toBeTruthy();
    expect(screen.queryByLabelText('Number format')).toBeNull();
  });

  it('toggles the mobile menu', () => {
    renderWithLocale(<MarketingHeader />);
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle.className).toContain('min-h-11');
    expect(toggle.className).toContain('min-w-11');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the mobile menu when a nav link is used', () => {
    renderWithLocale(<MarketingHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'How it works' }));
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
