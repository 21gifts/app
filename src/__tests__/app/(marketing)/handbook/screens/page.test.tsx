import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookScreensPage from '@/app/(marketing)/handbook/screens/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('HandbookScreensPage', () => {
  it('renders the Screens heading, stacked baselines, and viewport switches', async () => {
    renderWithLocale(await HandbookScreensPage());
    expect(screen.getByRole('heading', { name: 'Screens' })).toBeTruthy();
    expect(screen.queryByLabelText('Topic')).toBeNull();
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeTruthy();
    expect(screen.getByAltText('/ default')).toBeTruthy();
    expect(screen.getByAltText('/ mobile-nav')).toBeTruthy();
  });
});
