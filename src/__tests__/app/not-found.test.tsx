import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotFound from '@/app/not-found';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
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
  it('shows 404 and a home link', async () => {
    renderWithLocale(await NotFound());
    expect(screen.getByRole('heading', { name: '404' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back home' }).getAttribute('href')).toBe('/');
  });
});
