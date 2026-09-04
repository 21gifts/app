import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookScreensPage from '@/app/(marketing)/handbook/screens/page';
import { loadHandbookDocuments } from '@/lib/handbook';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

vi.mock('@/lib/handbook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/handbook')>();
  return {
    ...actual,
    loadHandbookDocuments: vi.fn(actual.loadHandbookDocuments),
  };
});

afterEach(cleanup);

describe('HandbookScreensPage', () => {
  it('renders the Screens heading, compact cards, and viewport switches', async () => {
    renderWithLocale(await HandbookScreensPage());
    expect(screen.getByRole('heading', { name: 'Screens' })).toBeTruthy();
    expect(screen.queryByLabelText('Topic')).toBeNull();
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeTruthy();
    expect(screen.getByAltText('/ default')).toBeTruthy();
    expect(screen.getByAltText('/ mobile-nav')).toBeTruthy();
    expect(document.getElementById('root-default')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: '/' })).toBeTruthy();
    expect(document.getElementById('chapter-root')).toBeTruthy();
    expect(document.getElementById('screen-root')).toBeTruthy();
    expect(screen.getByText(/Desktop\/wide layout/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to / default' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open / default at full size' })).toBeTruthy();
    expect(screen.queryByText('Open / default at full size')).toBeNull();
  });

  it('falls back to the catalog label when a description is missing', async () => {
    vi.mocked(loadHandbookDocuments).mockReturnValueOnce([
      { id: 'readme', title: 'Overview', markdown: '' },
      { id: 'screens', title: 'Screens', markdown: '# Screens\n' },
      { id: 'functions', title: 'Functions', markdown: '' },
      { id: 'endpoints', title: 'Endpoints', markdown: '' },
    ]);
    renderWithLocale(await HandbookScreensPage());
    const articles = document.querySelectorAll('article');
    expect(articles.length).toBeGreaterThan(0);
    expect(screen.getByAltText('/ default')).toBeTruthy();
    const root = document.getElementById('root-default');
    expect(root?.textContent).toContain('/ default');
  });
});
