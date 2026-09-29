import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessagesChromeLeft } from '@/components/MessagesChromeLeft';
import { recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: (): string => '/',
  useSearchParams: (): URLSearchParams => searchParams,
}));

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

afterEach(() => {
  searchParams.delete('c');
  resetViewHistory();
  cleanup();
});

describe('MessagesChromeLeft', () => {
  it('renders forum back when this tab has no earlier view', () => {
    renderWithLocale(<MessagesChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('returns to the messages list after that view was recorded', () => {
    recordCurrentView('/messages');
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: window.history.length + 1,
    });
    recordCurrentView('/messages?c=conv-21');
    searchParams.set('c', 'conv-21');
    renderWithLocale(<MessagesChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/messages');
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'All conversations' })).toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('renders forum back when c is an empty string and nothing was recorded', () => {
    searchParams.set('c', '');
    renderWithLocale(<MessagesChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });
});
