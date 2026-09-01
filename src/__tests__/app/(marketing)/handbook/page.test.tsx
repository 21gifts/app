import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookPage, * as handbookRoute from '@/app/(marketing)/handbook/page';
import { getRequestLocale } from '@/lib/request-locale';
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

describe('HandbookPage', () => {
  it('renders the Handbook heading and links to the three parts', async () => {
    renderWithLocale(await HandbookPage());
    expect(screen.getByRole('heading', { name: 'Handbook' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Handbook' })).toBeTruthy();
    const screens = screen.getAllByRole('link', { name: 'Screens' });
    expect(screens.some((link) => link.getAttribute('href') === '/handbook/screens')).toBe(true);
    const functions = screen.getAllByRole('link', { name: 'Functions' });
    expect(functions.some((link) => link.getAttribute('href') === '/handbook/functions')).toBe(
      true,
    );
    const endpoints = screen.getAllByRole('link', { name: 'Endpoints' });
    expect(endpoints.some((link) => link.getAttribute('href') === '/handbook/endpoints')).toBe(
      true,
    );
  });

  it('does not force-static the handbook route', () => {
    expect((handbookRoute as { dynamic?: string }).dynamic).not.toBe('force-static');
  });

  it('localizes the hub heading', async () => {
    vi.mocked(getRequestLocale).mockResolvedValueOnce('de');
    renderWithLocale(await HandbookPage(), 'de');
    expect(screen.getByRole('heading', { name: 'Handbuch' })).toBeTruthy();
  });

  it('links to the api handbook on GitHub', async () => {
    renderWithLocale(await HandbookPage());
    const link = screen.getByRole('link', { name: '21gifts/api' });
    expect(link.getAttribute('href')).toBe(
      'https://github.com/21gifts/api/tree/develop/docs/handbook',
    );
  });

  it('does not dump screens markdown on the hub', async () => {
    renderWithLocale(await HandbookPage());
    expect(document.getElementById('screens')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Screen: \// })).toBeNull();
  });
});
