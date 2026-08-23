import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketingHeader } from '@/components/MarketingHeader';

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

afterEach(cleanup);

describe('MarketingHeader', () => {
  it('links the wordmark home and Log in to /login', () => {
    render(<MarketingHeader />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Handbook', hidden: true }).getAttribute('href')).toBe(
      '/handbook',
    );
    expect(screen.getByRole('link', { name: 'Log in', hidden: true }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('toggles the mobile menu', () => {
    render(<MarketingHeader />);
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the mobile menu when a nav link is used', () => {
    render(<MarketingHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'How it works' }));
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
