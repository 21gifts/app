import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotFound from '@/app/not-found';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('NotFound', () => {
  it('shows 404, the one top-left back arrow, and localized wordmarks', async () => {
    renderWithLocale(await NotFound());
    expect(screen.getByRole('heading', { name: '404' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Back home' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    const wordmarks = screen.getAllByRole('link', { name: '21.gifts' });
    expect(wordmarks.map((link) => link.getAttribute('href'))).toEqual(['/en', '/en']);
    expect(screen.queryByLabelText('Number format')).toBeNull();
  });

  it('renders without an outer LocaleProvider', async () => {
    render(await NotFound());
    expect(screen.getByRole('heading', { name: '404' })).toBeTruthy();
  });
});
