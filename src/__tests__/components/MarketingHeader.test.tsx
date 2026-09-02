import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketingHeader } from '@/components/MarketingHeader';
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

afterEach(cleanup);

describe('MarketingHeader', () => {
  it('links the wordmark home and Log in to /login', () => {
    renderWithLocale(<MarketingHeader />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Stats', hidden: true }).getAttribute('href')).toBe(
      '/stats',
    );
    expect(screen.getByRole('link', { name: 'Handbook', hidden: true }).getAttribute('href')).toBe(
      '/handbook',
    );
    expect(screen.getByRole('link', { name: 'Log in', hidden: true }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('always shows the language switcher', () => {
    renderWithLocale(<MarketingHeader />);
    expect(screen.getByLabelText('Language')).toBeTruthy();
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
