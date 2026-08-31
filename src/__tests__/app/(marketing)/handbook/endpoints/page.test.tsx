import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookEndpointsPage from '@/app/(marketing)/handbook/endpoints/page';
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

describe('HandbookEndpointsPage', () => {
  it('renders the Endpoints heading and markdown, without image switches', async () => {
    renderWithLocale(await HandbookEndpointsPage());
    expect(screen.getByRole('heading', { name: 'Endpoints' })).toBeTruthy();
    expect(document.getElementById('endpoints')).not.toBeNull();
    expect(screen.queryByLabelText('Topic')).toBeNull();
  });

  it('omits the endpoints section when the handbook doc is missing', async () => {
    vi.mocked(loadHandbookDocuments).mockReturnValueOnce([]);
    renderWithLocale(await HandbookEndpointsPage());
    expect(screen.getByRole('heading', { name: 'Endpoints' })).toBeTruthy();
    expect(document.getElementById('endpoints')).toBeNull();
  });
});
