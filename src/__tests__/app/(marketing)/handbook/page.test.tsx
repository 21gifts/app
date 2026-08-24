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
  it('renders the Handbook heading', async () => {
    renderWithLocale(await HandbookPage());
    expect(screen.getByRole('heading', { name: 'Handbook' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Handbook' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Overview chapter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Screens chapter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Functions chapter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Endpoints chapter' })).toBeTruthy();
  });

  it('does not force-static the handbook route', () => {
    expect((handbookRoute as { dynamic?: string }).dynamic).not.toBe('force-static');
  });

  it('localizes chapter copy-link labels', async () => {
    vi.mocked(getRequestLocale).mockResolvedValueOnce('de');
    renderWithLocale(await HandbookPage(), 'de');
    expect(screen.getByRole('button', { name: 'Link kopieren zu Kapitel Overview' })).toBeTruthy();
  });

  it('links to the api handbook on GitHub', async () => {
    renderWithLocale(await HandbookPage());
    const link = screen.getByRole('link', { name: '21gifts/api' });
    expect(link.getAttribute('href')).toBe(
      'https://github.com/21gifts/api/tree/develop/docs/handbook',
    );
  });

  it('exposes the screens section', async () => {
    renderWithLocale(await HandbookPage());
    expect(document.getElementById('screens')).not.toBeNull();
  });

  it('points the overview screens.md link at the screens section', async () => {
    renderWithLocale(await HandbookPage());
    const links = screen.getAllByRole('link', { name: 'screens.md' });
    expect(links.some((link) => link.getAttribute('href') === '#screens')).toBe(true);
  });
});
