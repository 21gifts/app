import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessagesChromeLeft } from '@/components/MessagesChromeLeft';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
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
  cleanup();
});

describe('MessagesChromeLeft', () => {
  it('renders forum back when search params are empty', () => {
    renderWithLocale(<MessagesChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('renders All conversations back when c is a conversation id', () => {
    searchParams.set('c', 'conv-1');
    renderWithLocale(<MessagesChromeLeft />);
    expect(screen.getByRole('link', { name: 'All conversations' }).getAttribute('href')).toBe(
      '/messages',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('renders forum back when c is an empty string', () => {
    searchParams.set('c', '');
    renderWithLocale(<MessagesChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });
});
