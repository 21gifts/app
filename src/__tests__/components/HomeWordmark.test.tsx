import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { MouseEventHandler, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeWordmark } from '@/components/HomeWordmark';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

function setAdaSession(): void {
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
}

beforeEach(() => {
  hydrateReady = true;
  useAuthStore.setState({ session: null, account: null });
});

afterEach(() => {
  cleanup();
});

describe('HomeWordmark', () => {
  it('links home when there is no session', () => {
    renderWithLocale(<HomeWordmark />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
  });

  it('links to /welcome when a session is hydrated', () => {
    setAdaSession();
    renderWithLocale(<HomeWordmark />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('keeps the home href while hydration is not ready', () => {
    hydrateReady = false;
    setAdaSession();
    renderWithLocale(<HomeWordmark />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
  });

  it('forwards optional Wordmark props and does not preventDefault', () => {
    const onClick = vi.fn();
    renderWithLocale(<HomeWordmark tone="dark" size="footer" className="x" onClick={onClick} />);
    const link = screen.getByRole('link', { name: '21.gifts' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.className).toContain('text-paper');
    expect(link.className).toContain('text-[15px]');
    expect(link.className).toContain('x');
    const clickCompleted = fireEvent.click(link);
    expect(clickCompleted).toBe(true);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
